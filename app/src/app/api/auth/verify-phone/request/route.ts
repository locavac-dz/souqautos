import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendSms } from "@/lib/sms";
import { generateExpiry, generateNumericCode } from "@/lib/verification";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (!user.phone) {
    return NextResponse.json({ error: "no_phone" }, { status: 400 });
  }
  if (user.phoneVerifiedAt) {
    return NextResponse.json({ error: "already_verified" }, { status: 400 });
  }

  if (!(await checkRateLimit(`verify-phone-request:${user.id}`, { limit: 5, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const code = generateNumericCode();
  await prisma.phoneVerificationCode.deleteMany({ where: { userId: user.id } });
  await prisma.phoneVerificationCode.create({
    data: { userId: user.id, code, expiresAt: generateExpiry(10) },
  });

  // Lot 265 — un SMS non parti n'est plus un succès silencieux : 502 pour que l'écran dise « réessayez ».
  const sent = await sendSms({ to: user.phone, message: `Votre code de vérification Souq Auto : ${code}` });
  if (!sent) {
    return NextResponse.json({ error: "sms_failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
