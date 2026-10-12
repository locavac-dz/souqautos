import { NextRequest, NextResponse } from "next/server";
import { apiHandler, parseJsonBody } from "@/lib/api-route";
import { quoteRequestSchema } from "@/lib/validation/insurance";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/http";
import { sendEmail } from "@/lib/mailer";
import { DEV_ADMIN_EMAIL } from "@/lib/admin-bootstrap";
import { estimateAllFormulas } from "@/lib/insurance-estimate";
import { SITE_URL } from "@/lib/site";

export const POST = apiHandler(async (request: NextRequest) => {
  const ip = getClientIp(request);
  if (!(await checkRateLimit(`insurance-quote:${ip}`, { limit: 5, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await parseJsonBody(request, quoteRequestSchema, { issues: "full" });
  if (body instanceof NextResponse) return body;

  const { fiscalPower, year, wilayaId, formula, name, phone, email } = body;

  const estimates = estimateAllFormulas(fiscalPower);
  const chosen = estimates.find((e) => e.formula === formula);
  const priceRange = chosen ? `${chosen.lowDzd.toLocaleString("fr-DZ")} – ${chosen.highDzd.toLocaleString("fr-DZ")} DA` : "—";

  const formulaLabels: Record<string, string> = {
    rc: "RC seule",
    rc_tiers: "RC + Tiers collision",
    tous_risques: "Tous risques",
  };

  const recipient = process.env.ADMIN_EMAIL ?? DEV_ADMIN_EMAIL;

  await sendEmail({
    to: recipient,
    subject: `[souqautos.com] Demande de devis assurance — ${formulaLabels[formula]}`,
    html: `
      <h2>Nouvelle demande de devis assurance</h2>
      <table style="border-collapse:collapse;font-family:sans-serif">
        <tr><td style="padding:4px 12px 4px 0;font-weight:600">Nom</td><td>${escapeHtml(name)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:600">Téléphone</td><td>${escapeHtml(phone)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:600">E-mail</td><td>${escapeHtml(email)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:600">Formule</td><td>${formulaLabels[formula]}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:600">Fourchette estimée</td><td>${priceRange}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:600">Puissance fiscale</td><td>${fiscalPower} CV</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:600">Année</td><td>${year}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:600">Wilaya</td><td>${wilayaId}</td></tr>
      </table>
      <p style="margin-top:16px;font-size:12px;color:#666">
        Demande envoyée depuis <a href="${SITE_URL}/assurance">${SITE_URL}/assurance</a>
      </p>
    `,
    replyTo: email,
  });

  return NextResponse.json({ ok: true }, { status: 201 });
});

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
