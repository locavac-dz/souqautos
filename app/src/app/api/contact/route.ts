import { NextRequest, NextResponse } from "next/server";
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

  const body = await request.json().catch(() => null);
  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", issues: parsed.error.issues }, { status: 400 });
  }

  const { name, email, subject, message } = parsed.data;
  const to = process.env.ADMIN_EMAIL ?? DEV_ADMIN_EMAIL;

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
