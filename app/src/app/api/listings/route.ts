import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { listingSchema } from "@/lib/validation/listing";
import { savePhoto, PhotoValidationError } from "@/lib/uploads";
import { checkRateLimit } from "@/lib/rate-limit";

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
  const wilaya = await prisma.wilaya.findUnique({ where: { id: data.wilayaId } });
  if (!wilaya) {
    return NextResponse.json({ error: "unknown_wilaya" }, { status: 400 });
  }

  const phoneToUse = user.phone ?? data.phone;
  if (!phoneToUse) {
    return NextResponse.json({ error: "phone_required" }, { status: 400 });
  }
  if (!user.phone && data.phone) {
    await prisma.user.update({ where: { id: user.id }, data: { phone: data.phone } });
  }

  let savedPaths: string[];
  try {
    savedPaths = await Promise.all(photoFiles.map((file) => savePhoto(file)));
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
      brandFreeText: data.brandId ? null : data.brandFreeText,
      modelFreeText: data.modelId ? null : data.modelFreeText,
      title: data.title,
      description: data.description,
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
      // Lot 7 : file de modération — publication seulement après approbation admin (§39).
      status: "EN_ATTENTE",
      photos: {
        create: savedPaths.map((path, index) => ({ path, position: index })),
      },
      // Historique des prix (Lot 45) : première entrée dès la création.
      priceHistory: {
        create: [{ price: data.price }],
      },
    },
    select: { id: true },
  });

  return NextResponse.json({ listing }, { status: 201 });
}
