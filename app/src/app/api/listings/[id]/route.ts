import { NextRequest, NextResponse, after } from "next/server";
import { apiHandler, requireUser } from "@/lib/api-route";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { checkListingContentEditable } from "@/lib/listing-lifecycle";
import { canManageListing } from "@/lib/listing-access";
import { listingEditSchema } from "@/lib/validation/listing";
import { savePhoto, deleteStoredFile, PhotoValidationError, type SavedPhoto } from "@/lib/uploads";
import { computeListingContentHash, refreshListingFraudScore } from "@/lib/fraud-signals";
import { analyzeAndStoreListingFraud } from "@/lib/fraud-ai";
import { notifyStaffOfPending } from "@/lib/staff-alerts";
import { tryAutoPublish } from "@/lib/auto-publish";
import { validateCatalogueRefs } from "@/lib/listing-catalogue-refs";

const MIN_PHOTOS = 1;
const MAX_PHOTOS = 10;

// existingPhotoIds : ordre voulu des photos conservées (aussi leur nouvel
// ordre d'affichage) — toute photo de l'annonce absente de cette liste est
// retirée. Champ à part du reste, jamais validé par listingEditSchema.
const editPayloadSchema = z.object({
  existingPhotoIds: z.array(z.string()).default([]),
});

export const PATCH = apiHandler(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

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

  const data = parsed.data;

  // Mêmes vérifications catalogue qu'à la création (Lot 2, Lot 99 pour la
  // factorisation) : jamais un brandId/modelId/generationId/communeId/
  // equipmentId fabriqué côté client accepté tel quel.
  const catalogueValidation = await validateCatalogueRefs(data);
  if (!catalogueValidation.ok) {
    return NextResponse.json({ error: catalogueValidation.error }, { status: 400 });
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

  // Après la transaction seulement — jamais avant : un échec de suppression
  // de fichier ne doit jamais annuler une mutation déjà appliquée en base.
  await Promise.all(photosToDelete.map((p) => deleteStoredFile(p.path)));

  // Lot 272 — une annonce modifiée revient dans la file : l'équipe est prévenue, le score anti-fraude et l'analyse IA
  // sont recalculés sur le NOUVEAU contenu (ils ne l'étaient pas : l'ancien score restait affiché), puis la
  // publication automatique s'applique aux mêmes conditions qu'à la soumission.
  after(async () => {
    await notifyStaffOfPending("listing");
    await refreshListingFraudScore(id);
    await analyzeAndStoreListingFraud(id, {
      title: data.title,
      description: data.description,
      price: listing.price,
      condition: data.condition,
      year: data.year,
      mileage: data.mileage ?? null,
    });
    await tryAutoPublish(id);
  });

  return NextResponse.json({ status: "EN_ATTENTE" });
});
