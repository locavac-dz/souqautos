import { NextRequest, NextResponse } from "next/server";
import { apiHandler, requireUser, parseJsonBody } from "@/lib/api-route";
import crypto from "crypto";
import { z } from "zod";
import { emailSchema } from "@/lib/validation/auth";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth-server/password";
import { checkRateLimit } from "@/lib/rate-limit";
import { getTranslations } from "next-intl/server";
import { sendEmail } from "@/lib/mailer";
import { generateExpiry } from "@/lib/verification";
import { SITE_URL } from "@/lib/site";

const bodySchema = z.object({ newEmail: emailSchema, password: z.string().max(200).optional() });

export const POST = apiHandler(async (request: NextRequest) => {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  if (!(await checkRateLimit(`email-change-request:${user.id}`, { limit: 5, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await parseJsonBody(request, bodySchema);
  if (body instanceof NextResponse) return body;

  // Lot 229 — changer l'adresse de connexion, c'est pouvoir ensuite réinitialiser le mot de passe : une session volée ne doit pas
  // suffire. Le mot de passe est exigé, sauf pour un compte créé avec Google qui n'en a pas (il n'a que sa session).
  if (user.passwordHash && !(typeof body.password === "string" && (await verifyPassword(body.password, user.passwordHash)))) {
    return NextResponse.json({ error: "invalid_password" }, { status: 400 });
  }

  const newEmail = body.newEmail;
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
  // Lot 269 (audit D2) — courriel dans la langue du compte (il partait en français à tout le monde).
  const t = await getTranslations({ locale: user.locale, namespace: "Notifications" });
  const emailResult = await sendEmail({
    to: newEmail,
    subject: t("emailChangeSubject"),
    html: `<p>${t("greeting")}</p><p>${t("emailChangeBody")}</p><p><a href="${link}">${link}</a></p><p>${t("emailChangeExpiry")}</p>`,
  }).catch((err) => {
    console.error(`[EMAIL confirmation changement email] échec envoi: ${(err as Error).message}`);
    return null;
  });
  if (emailResult?.previewUrl) {
    console.log(`[EMAIL confirmation changement email] ${emailResult.previewUrl}`);
  }

  return NextResponse.json({ ok: true });
});
