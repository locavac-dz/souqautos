import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { canManageProListings } from "@/lib/pro-account";
import { parseProPermissions, type ProPermissions } from "@/lib/pro-permissions";
import { checkRateLimit } from "@/lib/rate-limit";
import { parseCsv, csvRowsToRecords } from "@/lib/csv";
import { mapCsvRowToListingInput, type ImportLookups } from "@/lib/bulk-import";
import type { ListingInput } from "@/lib/validation/listing";
import { getSubscriptionStatus } from "@/lib/pro-subscription";
import { computeListingContentHash } from "@/lib/fraud-signals";

const MAX_ROWS = 500;
// Lot 232 — 500 lignes au maximum de leur taille validée (titre 120, description 5 000 caractères, quelques champs courts) tiennent
// dans 3 Mo : au-delà, le fichier est refusé AVANT d'être lu en mémoire (l'ancien plafond ne comptait les lignes qu'après avoir tout chargé).
const MAX_FILE_BYTES = 4 * 1024 * 1024;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  if (!(await checkRateLimit(`bulk-import:${user.id}`, { limit: 10, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  // Content-Length est déclaré par le navigateur : suffisant pour refuser d'emblée un envoi hors gabarit, avant toute lecture en
  // base et sans le charger. La taille du fichier est revérifiée après l'analyse du formulaire, l'en-tête pouvant manquer.
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "file_too_large" }, { status: 413 });
  }

  const { id } = await params;
  const account = await prisma.professionalAccount.findUnique({ where: { id }, include: { user: true } });
  if (!account) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let permissions: ProPermissions | null = null;
  const isOwner = account.userId === user.id;
  if (!isOwner) {
    const collaborator = await prisma.proCollaborator.findUnique({
      where: { professionalAccountId_userId: { professionalAccountId: id, userId: user.id } },
    });
    permissions = collaborator ? parseProPermissions(collaborator.permissions) : null;
  }
  if (!canManageProListings({ isOwner, permissions })) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Le téléphone (obligatoire pour toute annonce, Lot 2) appartient au
  // compte propriétaire, pas à l'importateur — un collaborateur ne peut pas
  // le fournir à sa place.
  if (!account.user.phone) {
    return NextResponse.json({ error: "phone_required" }, { status: 400 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "file_required" }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "file_too_large" }, { status: 413 });
  }

  const text = await file.text();
  const records = csvRowsToRecords(parseCsv(text));
  if (records.length === 0) {
    return NextResponse.json({ error: "empty_file" }, { status: 400 });
  }
  if (records.length > MAX_ROWS) {
    return NextResponse.json({ error: "too_many_rows" }, { status: 400 });
  }

  const [brands, wilayas] = await Promise.all([
    prisma.brand.findMany({ include: { models: true } }),
    prisma.wilaya.findMany(),
  ]);

  const lookups: ImportLookups = {
    brands: new Map(
      brands.map((b) => [
        b.name.trim().toLowerCase(),
        {
          id: b.id,
          models: new Map(b.models.map((m) => [m.name.trim().toLowerCase(), m.id])),
          modelCategories: new Map(b.models.map((m) => [m.id, m.categories])),
        },
      ])
    ),
    wilayas: new Map([
      ...wilayas.map((w): [string, number] => [w.code.trim().toLowerCase(), w.id]),
      ...wilayas.map((w): [string, number] => [w.nomFr.trim().toLowerCase(), w.id]),
    ]),
  };

  const rejected: { row: number; error: string }[] = [];
  const toCreate: ListingInput[] = [];

  records.forEach((record, index) => {
    const result = mapCsvRowToListingInput(record, lookups);
    if (result.ok) {
      toCreate.push(result.data);
    } else {
      // +2 : ligne 1 = en-tête, les données commencent en ligne 2.
      rejected.push({ row: index + 2, error: result.error });
    }
  });

  // Lot 79 — quota d'annonces actives par palier d'abonnement (§4-B) : un
  // import ne peut pas contourner le quota en ajoutant d'un coup plus de
  // lignes que la place restante, jamais un rejet partiel silencieux qui
  // laisserait deviner combien sont réellement passées.
  if (toCreate.length > 0) {
    const subscriptionStatus = await getSubscriptionStatus(account.userId);
    if (subscriptionStatus && subscriptionStatus.quota !== null) {
      const remaining = subscriptionStatus.quota - subscriptionStatus.activeListingCount;
      if (toCreate.length > remaining) {
        return NextResponse.json(
          { error: "quota_exceeded", quota: subscriptionStatus.quota, remaining: Math.max(remaining, 0) },
          { status: 400 }
        );
      }
    }
  }

  if (toCreate.length > 0) {
    await prisma.listing.createMany({
      data: toCreate.map((data) => ({
        sellerId: account.userId,
        category: data.category,
        brandId: data.brandId ?? null,
        modelId: data.modelId ?? null,
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
        // Import de masse (Lot 41) : jamais de photo fournie par un CSV —
        // BROUILLON tant que le professionnel n'a pas complété chaque annonce
        // avec de vraies photos via l'édition existante (Lot 30/35/36), seul
        // point d'entrée qui fait ensuite repasser l'annonce en modération
        // (EN_ATTENTE), jamais un contournement de la file d'attente humaine.
        status: "BROUILLON",
      })),
    });
  }

  return NextResponse.json({ imported: toCreate.length, rejected });
}
