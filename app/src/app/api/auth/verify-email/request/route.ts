import { NextResponse } from "next/server";
import { apiHandler, requireUser } from "@/lib/api-route";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/mailer";
import { generateExpiry } from "@/lib/verification";
import { SITE_URL } from "@/lib/site";

export const POST = apiHandler(async () => {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  if (user.emailVerifiedAt) {
    return NextResponse.json({ error: "already_verified" }, { status: 409 });
  }

  if (!(await checkRateLimit(`verify-email-request:${user.id}`, { limit: 3, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const token = crypto.randomBytes(32).toString("hex");
  await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } });
  await prisma.emailVerificationToken.create({
    data: { userId: user.id, token, expiresAt: generateExpiry(24 * 60) },
  });

  const link = `${SITE_URL}/${user.locale}/verifier-email/${token}`;
  const { previewUrl } = await sendEmail({
    to: user.email,
    subject: "Vérifiez votre adresse email — Souq Auto",
    html: `<p>Bonjour,</p><p>Cliquez sur ce lien pour vérifier votre adresse email :</p><p><a href="${link}">${link}</a></p><p>Ce lien expire dans 24 heures.</p>`,
  });

  return NextResponse.json({ ok: true, previewUrl });
});
