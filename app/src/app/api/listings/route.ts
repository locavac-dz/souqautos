import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { listingSchema } from "@/lib/validation/listing";
import { savePhoto, PhotoValidationError, type SavedPhoto } from "@/lib/uploads";
import { checkRateLimit } from "@/lib/rate-limit";
import { getSubscriptionStatus, isWithinQuota } from "@/lib/pro-subscription";
import { computeListingContentHash } from "@/lib/fraud-signals";

const MIN_PHOTOS = 1;
const MAX_PHOTOS = 10;

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  if (!checkRateLimit(`create-listing:${user.id}`, { limit: 5, windowMs: 60 * 60 * 1000 })) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const formData = await request.formData();
  const raw = formData.get("data");
  if (typeof raw !== "string") {
    return NextResponse.json({ error: "validation" }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "validation" }, { status: 400 });
  }

  const parsed = listingSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const photoFiles = formData
    .getAll("photos")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (photoFiles.length < MIN_PHOTOS) {
    return NextResponse.json({ error: "at_least_one_photo" }, { status: 400 });
  }
  if (photoFiles.length > MAX_PHOTOS) {
    return NextResponse.json({ error: "too_many_photos" }, { status: 400 });
  }

  if (data.brandId) {
    const brand = await prisma.brand.findUnique({ where: { id: data.brandId } });
    if (!brand) {
      return NextResponse.json({ error: "unknown_brand" }, { status: 400 });
    }
  }
  if (data.modelId) {
    const model = await prisma.model.findUnique({ where: { id: data.modelId } });
    if (!model || (data.brandId && model.brandId !== data.brandId)) {
      return NextResponse.json({ error: "unknown_model" }, { status: 400 });
    }
  }
  // Lot 88 — même discipline que brandId/modelId : une génération n'est
  // acceptée que si elle appartient réellement au modèle choisi.
  if (data.generationId) {
    const generation = await prisma.generation.findUnique({ where: { id: data.generationId } });
    if (!generation || generation.modelId !== data.modelId) {
      return NextResponse.json({ error: "unknown_generation" }, { status: 400 });
    }
  }
  const wilaya = await prisma.wilaya.findUnique({ where: { id: data.wilayaId } });
  if (!wilaya) {
    return NextResponse.json({ error: "unknown_wilaya" }, { status: 400 });
  }
  // Lot 87 — même discipline que brandId/modelId : une commune n'est acceptée
  // que si elle appartient réellement à la wilaya choisie, jamais fabriquée.
  if (data.communeId) {
    const commune = await prisma.commune.findUnique({ where: { id: data.communeId } });
    if (!commune || commune.wilayaId !== data.wilayaId) {
      return NextResponse.json({ error: "unknown_commune" }, { status: 400 });
    }
  }

  // Même discipline que brandId/modelId : jamais un id d'équipement fabriqué
  // côté client accepté tel quel (Lot 72).
  if (data.equipmentIds.length > 0) {
    const matchingCount = await prisma.equipment.count({ where: { id: { in: data.equipmentIds } } });
    if (matchingCount !== new Set(data.equipmentIds).size) {
      return NextResponse.json({ error: "unknown_equipment" }, { status: 400 });
    }
  }

  const phoneToUse = user.phone ?? data.phone;
  if (!phoneToUse) {
    return NextResponse.json({ error: "phone_required" }, { status: 400 });
  }
  if (!user.phone && data.phone) {
    await prisma.user.update({ where: { id: user.id }, data: { phone: data.phone } });
  }

  // Lot 79 — quota d'annonces actives par palier d'abonnement pro (§4-B).
  // `null` pour un particulier (pas de compte pro) : jamais de quota appliqué
  // hors de son périmètre documenté.
  const subscriptionStatus = await getSubscriptionStatus(user.id);
  if (subscriptionStatus && !isWithinQuota(subscriptionStatus.activeListingCount, subscriptionStatus.quota)) {
    return NextResponse.json({ error: "quota_exceeded" }, { status: 400 });
  }

  let savedPhotos: SavedPhoto[];
  try {
    savedPhotos = await Promise.all(photoFiles.map((file) => savePhoto(file)));
  } catch (error) {
    if (error instanceof PhotoValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  const listing = await prisma.listing.create({
    data: {
      sellerId: user.id,
      category: data.category,
      brandId: data.brandId ?? null,
      modelId: data.modelId ?? null,
      generationId: data.generationId ?? null,
      brandFreeText: data.brandId ? null : data.brandFreeText,
      modelFreeText: data.modelId ? null : data.modelFreeText,
      title: data.title,
      description: data.description,
      contentHash: computeListingContentHash(data.title, data.description),
      price: data.price,
      year: data.year,
      mileage: data.mileage,
      fuelType: data.fuelType,
      gearbox: data.gearbox,
      transmission: data.transmission ?? null,
      color: data.color ?? null,
      doors: data.doors ?? null,
      seats: data.seats ?? null,
      powerHp: data.powerHp ?? null,
      condition: data.condition,
      firstHand: data.firstHand,
      accidented: data.accidented,
      wilayaId: data.wilayaId,
      communeId: data.communeId ?? null,
      // Lot 7 : file de modération — publication seulement après approbation admin (§39).
      status: "EN_ATTENTE",
      photos: {
        create: savedPhotos.map((photo, index) => ({
          path: photo.path,
          sha256: photo.sha256,
          qualityFlags: JSON.stringify(photo.qualityFlags),
          position: index,
        })),
      },
      // Historique des prix (Lot 45) : première entrée dès la création.
      priceHistory: {
        create: [{ price: data.price }],
      },
      equipments: {
        create: data.equipmentIds.map((equipmentId) => ({ equipmentId })),
      },
    },
    select: { id: true },
  });

  return NextResponse.json({ listing }, { status: 201 });
}
