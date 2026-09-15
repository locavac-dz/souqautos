import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { checkRateLimit } from "@/lib/rate-limit";
import { checkListingContentEditable } from "@/lib/listing-lifecycle";
import { canManageListing } from "@/lib/listing-access";
import { listingEditSchema } from "@/lib/validation/listing";
import { savePhoto, PhotoValidationError, type SavedPhoto } from "@/lib/uploads";
import { computeListingContentHash } from "@/lib/fraud-signals";

const MIN_PHOTOS = 1;
const MAX_PHOTOS = 10;

// existingPhotoIds : ordre voulu des photos conservées (aussi leur nouvel
// ordre d'affichage) — toute photo de l'annonce absente de cette liste est
// retirée. Champ à part du reste, jamais validé par listingEditSchema.
const editPayloadSchema = z.object({
  existingPhotoIds: z.array(z.string()).default([]),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  if (!(await checkRateLimit(`edit-listing:${user.id}`, { limit: 20, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { id } = await params;
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

  const parsed = listingEditSchema.safeParse(payload);
  const parsedPhotos = editPayloadSchema.safeParse(payload);
  if (!parsed.success || !parsedPhotos.success) {
    return NextResponse.json({ error: "validation" }, { status: 400 });
  }

  const listing = await prisma.listing.findUnique({ where: { id }, include: { photos: true } });
  if (!listing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!(await canManageListing(user.id, listing.sellerId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const eligibility = checkListingContentEditable(listing.status);
  if (!eligibility.ok) {
    return NextResponse.json({ error: eligibility.error }, { status: 400 });
  }

  const wilaya = await prisma.wilaya.findUnique({ where: { id: parsed.data.wilayaId } });
  if (!wilaya) {
    return NextResponse.json({ error: "unknown_wilaya" }, { status: 400 });
  }
  // Lot 87 — même discipline que brandId/modelId : une commune n'est acceptée
  // que si elle appartient réellement à la wilaya choisie, jamais fabriquée.
  if (parsed.data.communeId) {
    const commune = await prisma.commune.findUnique({ where: { id: parsed.data.communeId } });
    if (!commune || commune.wilayaId !== parsed.data.wilayaId) {
      return NextResponse.json({ error: "unknown_commune" }, { status: 400 });
    }
  }

  const data = parsed.data;

  // Mêmes vérifications catalogue qu'à la création (Lot 2) : jamais un
  // brandId/modelId fabriqué côté client, jamais un modèle qui n'appartient
  // pas à la marque choisie.
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

  // Même discipline que brandId/modelId : jamais un id d'équipement fabriqué
  // côté client accepté tel quel (Lot 72/73).
  if (data.equipmentIds.length > 0) {
    const matchingCount = await prisma.equipment.count({ where: { id: { in: data.equipmentIds } } });
    if (matchingCount !== new Set(data.equipmentIds).size) {
      return NextResponse.json({ error: "unknown_equipment" }, { status: 400 });
    }
  }

  // Seules les photos appartenant réellement à cette annonce peuvent être
  // conservées — un id étranger fourni par le client est silencieusement ignoré.
  const existingIds = listing.photos.map((p) => p.id);
  const keptPhotoIds = parsedPhotos.data.existingPhotoIds.filter((pid) => existingIds.includes(pid));

  const newPhotoFiles = formData
    .getAll("newPhotos")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  const totalPhotoCount = keptPhotoIds.length + newPhotoFiles.length;
  if (totalPhotoCount < MIN_PHOTOS) {
    return NextResponse.json({ error: "at_least_one_photo" }, { status: 400 });
  }
  if (totalPhotoCount > MAX_PHOTOS) {
    return NextResponse.json({ error: "too_many_photos" }, { status: 400 });
  }

  let savedPhotos: SavedPhoto[];
  try {
    savedPhotos = await Promise.all(newPhotoFiles.map((file) => savePhoto(file)));
  } catch (error) {
    if (error instanceof PhotoValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  const photosToDelete = listing.photos.filter((p) => !keptPhotoIds.includes(p.id));

  // Une édition de contenu renvoie l'annonce en modération — jamais un
  // contournement silencieux de la vérification humaine (§39). Seul le prix
  // (Lot 23) reste modifiable sans repasser par la file d'attente : lui seul
  // n'était pas dans le périmètre du contrôle éditorial d'origine du Lot 7.
  await prisma.$transaction([
    ...photosToDelete.map((p) => prisma.listingPhoto.delete({ where: { id: p.id } })),
    ...keptPhotoIds.map((pid, index) =>
      prisma.listingPhoto.update({ where: { id: pid }, data: { position: index } })
    ),
    ...savedPhotos.map((photo, i) =>
      prisma.listingPhoto.create({
        data: {
          listingId: id,
          path: photo.path,
          sha256: photo.sha256,
          qualityFlags: JSON.stringify(photo.qualityFlags),
          position: keptPhotoIds.length + i,
        },
      })
    ),
    prisma.listing.update({
      where: { id },
      data: {
        category: data.category,
        brandId: data.brandId ?? null,
        modelId: data.modelId ?? null,
        generationId: data.generationId ?? null,
        brandFreeText: data.brandId ? null : data.brandFreeText,
        modelFreeText: data.modelId ? null : data.modelFreeText,
        title: data.title,
        description: data.description,
        contentHash: computeListingContentHash(data.title, data.description),
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
        status: "EN_ATTENTE",
        moderationNote: null,
        // Remplace entièrement la sélection précédente (Lot 73) — jamais un
        // ajout cumulatif, l'utilisateur voit et coche l'état complet voulu.
        equipments: {
          deleteMany: {},
          create: data.equipmentIds.map((equipmentId) => ({ equipmentId })),
        },
      },
    }),
  ]);

  return NextResponse.json({ status: "EN_ATTENTE" });
}
