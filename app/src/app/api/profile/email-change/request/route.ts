import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/mailer";
import { generateExpiry } from "@/lib/verification";
import { SITE_URL } from "@/lib/site";

const bodySchema = z.object({ newEmail: z.string().trim().toLowerCase().email() });

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  if (!(await checkRateLimit(`email-change-request:${user.id}`, { limit: 5, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation" }, { status: 400 });
  }

  const newEmail = parsed.data.newEmail;
  if (newEmail === user.email) {
    return NextResponse.json({ error: "same_email" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email: newEmail } });
  if (existing) {
    return NextResponse.json({ error: "email_taken" }, { status: 409 });
  }

  const token = crypto.randomBytes(32).toString("hex");
  // Une seule demande en attente à la fois — une nouvelle demande annule
  // silencieusement les précédentes (jamais deux liens valides en même temps).
  await prisma.emailChangeRequest.deleteMany({ where: { userId: user.id } });
  await prisma.emailChangeRequest.create({
    data: { userId: user.id, newEmail, token, expiresAt: generateExpiry(24 * 60) },
  });

  // Le lien part vers la NOUVELLE adresse — jamais l'ancienne — seule la
  // preuve de réception à la nouvelle adresse justifie le changement.
  const link = `${SITE_URL}/${user.locale}/confirmer-email/${token}`;
  const emailResult = await sendEmail({
    to: newEmail,
    subject: "Confirmez votre nouvelle adresse email — Souq Auto",
    html: `<p>Bonjour,</p><p>Cliquez sur ce lien pour confirmer que cette adresse est bien la vôtre et l'utiliser pour vous connecter à Souq Auto :</p><p><a href="${link}">${link}</a></p><p>Ce lien expire dans 24 heures. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>`,
  }).catch((err) => {
    console.error(`[EMAIL confirmation changement email] échec envoi: ${(err as Error).message}`);
    return null;
  });
  if (emailResult?.previewUrl) {
    console.log(`[EMAIL confirmation changement email] ${emailResult.previewUrl}`);
  }

  return NextResponse.json({ ok: true });
}
