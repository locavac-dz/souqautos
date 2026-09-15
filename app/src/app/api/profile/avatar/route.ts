import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { checkRateLimit } from "@/lib/rate-limit";
import { saveAvatar, deleteStoredFile, PhotoValidationError } from "@/lib/uploads";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

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
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const previous = await prisma.profile.findUnique({ where: { userId: user.id }, select: { avatarUrl: true } });
  await prisma.profile.update({ where: { userId: user.id }, data: { avatarUrl: null } });
  if (previous?.avatarUrl) await deleteStoredFile(previous.avatarUrl);

  return NextResponse.json({ ok: true });
}
