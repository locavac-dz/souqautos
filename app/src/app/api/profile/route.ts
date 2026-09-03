import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { profileUpdateSchema } from "@/lib/validation/profile";
import { shouldResetPhoneVerification } from "@/lib/profile";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  if (!checkRateLimit(`update-profile:${user.id}`, { limit: 20, windowMs: 60 * 60 * 1000 })) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = profileUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation" }, { status: 400 });
  }

  if (parsed.data.wilayaId) {
    const wilaya = await prisma.wilaya.findUnique({ where: { id: parsed.data.wilayaId } });
    if (!wilaya) {
      return NextResponse.json({ error: "validation" }, { status: 400 });
    }
  }

  const newPhone = parsed.data.phone?.trim() || null;
  if (newPhone && newPhone !== user.phone) {
    const existingPhone = await prisma.user.findUnique({ where: { phone: newPhone } });
    if (existingPhone && existingPhone.id !== user.id) {
      return NextResponse.json({ error: "phone_taken" }, { status: 409 });
    }
  }

  const resetPhoneVerification = shouldResetPhoneVerification({ oldPhone: user.phone, newPhone });

  await prisma.$transaction([
    prisma.profile.update({
      where: { userId: user.id },
      data: {
        displayName: parsed.data.displayName,
        wilayaId: parsed.data.wilayaId ?? null,
        bio: parsed.data.bio?.trim() || null,
      },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: {
        phone: newPhone,
        ...(resetPhoneVerification ? { phoneVerifiedAt: null } : {}),
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
