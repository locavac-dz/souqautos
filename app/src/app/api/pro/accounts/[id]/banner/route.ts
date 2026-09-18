import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { checkRateLimit } from "@/lib/rate-limit";
import { saveProBanner, deleteStoredFile, PhotoValidationError } from "@/lib/uploads";

// Lot 103 — voir logo/route.ts pour la justification de la restriction au
// seul propriétaire du compte pro.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.professionalAccount?.id !== id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (!(await checkRateLimit(`upload-pro-banner:${user.id}`, { limit: 10, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const formData = await request.formData();
  const file = formData.get("banner");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "validation" }, { status: 400 });
  }

  let bannerUrl: string;
  try {
    bannerUrl = await saveProBanner(file);
  } catch (error) {
    if (error instanceof PhotoValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  const previous = await prisma.professionalAccount.findUnique({ where: { id }, select: { bannerUrl: true } });
  await prisma.professionalAccount.update({ where: { id }, data: { bannerUrl } });
  if (previous?.bannerUrl) await deleteStoredFile(previous.bannerUrl);

  return NextResponse.json({ bannerUrl });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.professionalAccount?.id !== id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const previous = await prisma.professionalAccount.findUnique({ where: { id }, select: { bannerUrl: true } });
  await prisma.professionalAccount.update({ where: { id }, data: { bannerUrl: null } });
  if (previous?.bannerUrl) await deleteStoredFile(previous.bannerUrl);

  return NextResponse.json({ ok: true });
}
