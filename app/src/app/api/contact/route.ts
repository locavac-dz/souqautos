import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "@/lib/api-route";
import { contactSchema } from "@/lib/validation/contact";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/http";
import { sendEmail, escapeHtml } from "@/lib/mailer";
import { DEV_ADMIN_EMAIL } from "@/lib/admin-bootstrap";

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  if (!(await checkRateLimit(`contact:${ip}`, { limit: 3, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await parseJsonBody(request, contactSchema, { issues: "full" });
  if (body instanceof NextResponse) return body;

  const { name, email, subject, message } = body;
  // Lot 265 (audit, constat A5) — en production, pas de repli sur l'adresse de développement : sans ADMIN_EMAIL,
  // le message serait parti vers un domaine non maîtrisé sans que personne ne le sache. `launch:check` l'exige.
  const to = process.env.ADMIN_EMAIL?.trim() || (process.env.NODE_ENV !== "production" ? DEV_ADMIN_EMAIL : null);
  if (!to) {
    console.error("[contact] ADMIN_EMAIL non défini : message de contact refusé");
    return NextResponse.json({ error: "contact_unavailable" }, { status: 503 });
  }

  const html = `
    <p><strong>Nom :</strong> ${escapeHtml(name)}</p>
    <p><strong>Email :</strong> ${escapeHtml(email)}</p>
    <p><strong>Sujet :</strong> ${escapeHtml(subject)}</p>
    <hr />
    <p style="white-space:pre-wrap">${escapeHtml(message)}</p>
  `;

  try {
    const result = await sendEmail({ to, subject: `[Contact] ${name} — ${subject}`, html });
    if (result.previewUrl) {
      console.log(`[DEV contact] Aperçu : ${result.previewUrl}`);
    }
  } catch (err) {
    console.error(`[contact] Envoi impossible : ${(err as Error).message}`);
    return NextResponse.json({ error: "send_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
