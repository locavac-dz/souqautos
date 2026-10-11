import { NextRequest, NextResponse } from "next/server";
import { apiHandler, requireUser } from "@/lib/api-route";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { saveAvatar, deleteStoredFile, PhotoValidationError } from "@/lib/uploads";

export const POST = apiHandler(async (request: NextRequest) => {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  if (!(await checkRateLimit(`upload-avatar:${user.id}`, { limit: 10, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const formData = await request.formData();
  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "validation" }, { status: 400 });
  }

  let avatarUrl: string;
  try {
    avatarUrl = await saveAvatar(file);
  } catch (error) {
    if (error instanceof PhotoValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  const previous = await prisma.profile.findUnique({ where: { userId: user.id }, select: { avatarUrl: true } });
  await prisma.profile.update({ where: { userId: user.id }, data: { avatarUrl } });
  // Après la mutation seulement, jamais avant — même discipline que la
  // suppression de photo d'annonce.
  if (previous?.avatarUrl) await deleteStoredFile(previous.avatarUrl);

  return NextResponse.json({ avatarUrl });
});

export const DELETE = apiHandler(async () => {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const previous = await prisma.profile.findUnique({ where: { userId: user.id }, select: { avatarUrl: true } });
  await prisma.profile.update({ where: { userId: user.id }, data: { avatarUrl: null } });
  if (previous?.avatarUrl) await deleteStoredFile(previous.avatarUrl);

  return NextResponse.json({ ok: true });
});
