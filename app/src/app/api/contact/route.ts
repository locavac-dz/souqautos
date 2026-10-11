import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { apiHandler, parseJsonBody } from "@/lib/api-route";
import { contactSchema } from "@/lib/validation/contact";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/http";
import { sendEmail, sendEmailBestEffort } from "@/lib/mailer";
import { DEV_ADMIN_EMAIL } from "@/lib/admin-bootstrap";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/site";
import { isUniqueViolation } from "@/lib/prisma-errors";
import {
  CONTACT_SUBJECT_ENUM,
  buildContactAcknowledgement,
  buildTeamContactEmail,
  generateContactReference,
  resolveContactRecipients,
} from "@/lib/contact-messages";

// Lot 273 — un message de contact n'est plus un simple courriel : il est enregistré (file /admin/contact), routé
// vers la bonne boîte selon le motif, et le client reçoit un accusé de réception avec sa référence.
const bodySchema = contactSchema.extend({ locale: z.enum(["fr", "ar"]).default("fr") });

export const POST = apiHandler(async (request: NextRequest) => {
  const ip = getClientIp(request);
  if (!(await checkRateLimit(`contact:${ip}`, { limit: 3, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await parseJsonBody(request, bodySchema, { issues: "full" });
  if (body instanceof NextResponse) return body;

  const { name, email, subject, message, locale } = body;
  // Lot 265 (audit, constat A5) — en production, pas de repli sur l'adresse de développement : sans ADMIN_EMAIL,
  // le message serait parti vers un domaine non maîtrisé sans que personne ne le sache. `launch:check` l'exige.
  const recipients = resolveContactRecipients(subject, process.env, DEV_ADMIN_EMAIL);
  if (recipients.length === 0) {
    console.error("[contact] ADMIN_EMAIL et STAFF_ALERT_EMAILS non définis : message de contact refusé");
    return NextResponse.json({ error: "contact_unavailable" }, { status: 503 });
  }

  // Référence unique : trois tirages suffisent largement (31^6 combinaisons).
  let stored: { id: string; reference: string } | null = null;
  for (let attempt = 0; attempt < 3 && !stored; attempt++) {
    try {
      stored = await prisma.contactMessage.create({
        data: {
          reference: generateContactReference(),
          name,
          email,
          subject: CONTACT_SUBJECT_ENUM[subject],
          message,
          locale,
          routedTo: recipients.join(", "),
        },
        select: { id: true, reference: true },
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }
  if (!stored) {
    return NextResponse.json({ error: "send_failed" }, { status: 500 });
  }
  const { id, reference } = stored;

  // Courriel à l'équipe, Reply-To = le client. Un échec ici n'est pas une perte : le message est dans la file.
  const team = buildTeamContactEmail({ reference, name, email, subject, message, locale, siteUrl: SITE_URL });
  await Promise.all(
    recipients.map(async (to) => {
      try {
        const result = await sendEmail({ to, subject: team.subject, html: team.html, replyTo: email });
        if (result.previewUrl) console.log(`[contact ${reference}] Aperçu équipe : ${result.previewUrl}`);
      } catch (err) {
        console.error(`[contact ${reference}] courriel équipe vers ${to} impossible : ${(err as Error).message}`);
      }
    })
  );

  // Accusé de réception au client, après la réponse HTTP, au mieux.
  after(async () => {
    const t = await getTranslations({ locale, namespace: "ContactEmails" });
    const ack = buildContactAcknowledgement(t, { reference, name, subject, siteUrl: SITE_URL, locale });
    const result = await sendEmailBestEffort(`contact ${reference} accusé`, { to: email, subject: ack.subject, html: ack.html });
    if (result) {
      await prisma.contactMessage.update({ where: { id }, data: { ackSentAt: new Date() } }).catch(() => null);
    }
  });

  return NextResponse.json({ ok: true, reference }, { status: 201 });
});
