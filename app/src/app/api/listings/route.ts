import { NextRequest, NextResponse, after } from "next/server";
import { notifyStaffOfPending } from "@/lib/staff-alerts";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { listingSchema } from "@/lib/validation/listing";
import { savePhoto, PhotoValidationError, type SavedPhoto } from "@/lib/uploads";
import { checkRateLimit } from "@/lib/rate-limit";
import { getSubscriptionStatus, isWithinQuota } from "@/lib/pro-subscription";
import { computeListingContentHash, refreshListingFraudScore } from "@/lib/fraud-signals";
import { analyzeAndStoreListingFraud } from "@/lib/fraud-ai";
import { validateCatalogueRefs } from "@/lib/listing-catalogue-refs";
import { isUniqueViolation } from "@/lib/prisma-errors";

const MIN_PHOTOS = 1;
const MAX_PHOTOS = 10;

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  if (!(await checkRateLimit(`create-listing:${user.id}`, { limit: 5, windowMs: 60 * 60 * 1000 }))) {
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

  const catalogueValidation = await validateCatalogueRefs(data);
  if (!catalogueValidation.ok) {
    return NextResponse.json({ error: catalogueValidation.error }, { status: 400 });
  }

  const phoneToUse = user.phone ?? data.phone;
  if (!phoneToUse) {
    return NextResponse.json({ error: "phone_required" }, { status: 400 });
  }
  if (!user.phone && data.phone) {
    // Le numéro est unique : s'il appartient déjà à un autre compte, répondre par une erreur claire
    // (comme la route du profil) plutôt que de laisser la base lever une erreur 500.
    try {
      await prisma.user.update({ where: { id: user.id }, data: { phone: data.phone } });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return NextResponse.json({ error: "phone_taken" }, { status: 409 });
      }
      throw error;
    }
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
      fiscalPower: data.fiscalPower ?? null,
      bodyType: data.bodyType ?? null,
      negotiable: data.negotiable,
      condition: data.condition,
      firstHand: data.firstHand,
      accidented: data.accidented,
      controltechniqueExpiry: data.controltechniqueExpiry ?? null,
      assuranceExpiry: data.assuranceExpiry ?? null,
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

  // Lot 118 — prévient l'équipe. Lot 246 — calcule les signaux anti-fraude et
  // lance l'analyse IA du texte ; les deux sont non-bloquants (after).
  const listingId = listing.id;
  const listingForAi = {
    title: data.title,
    description: data.description,
    price: data.price,
    condition: data.condition,
    year: data.year,
    mileage: data.mileage,
  } as const;
  after(async () => {
    await notifyStaffOfPending("listing");
    await refreshListingFraudScore(listingId);
    await analyzeAndStoreListingFraud(listingId, listingForAi);
  });

  return NextResponse.json({ listing }, { status: 201 });
}
