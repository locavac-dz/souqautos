import { parseAlertEmails } from "@/lib/alert-recipients";
import { sendEmailBestEffort, escapeHtml } from "@/lib/mailer";
import { SITE_URL } from "@/lib/site";
import type { EditorialDraftResult } from "@/lib/editorial-draft-sweep";

export function resolveEditorialNotifyRecipients(env: Record<string, string | undefined>): string[] {
  const staff = parseAlertEmails(env.STAFF_ALERT_EMAILS);
  const admin = parseAlertEmails(env.ADMIN_EMAIL);
  return [...new Set([...staff, ...admin])];
}

export function buildEditorialNotifyEmail(result: EditorialDraftResult): { subject: string; html: string } | null {
  const items: string[] = [];

  if (result.articleDraft) {
    items.push(`<li>Article Mag : <a href="${escapeHtml(`${SITE_URL}/admin/mag`)}">${escapeHtml(result.articleDraft)}</a></li>`);
  }
  if (result.pressReviewDraft) {
    items.push(`<li>Revue de presse : <a href="${escapeHtml(`${SITE_URL}/admin/mag`)}">${escapeHtml(result.pressReviewDraft)}</a></li>`);
  }
  if (result.guideDraft) {
    items.push(`<li>Guide d'achat : <a href="${escapeHtml(`${SITE_URL}/admin/guides`)}">${escapeHtml(result.guideDraft)}</a></li>`);
  }

  if (items.length === 0) return null;

  const count = items.length;
  const subject = `souqautos.com — ${count} brouillon${count > 1 ? "s" : ""} IA à relire`;

  const html = `<p>Le cron éditorial a généré ${count} brouillon${count > 1 ? "s" : ""} IA :</p>
<ul>${items.join("")}</ul>
<p>Ces brouillons ne sont <strong>pas publiés</strong>. Relisez-les et publiez-les depuis l'administration.</p>`;

  return { subject, html };
}

export async function notifyEditorialDrafts(result: EditorialDraftResult): Promise<number> {
  const email = buildEditorialNotifyEmail(result);
  if (!email) return 0;

  const recipients = resolveEditorialNotifyRecipients(process.env);
  if (recipients.length === 0) return 0;

  await Promise.all(
    recipients.map((to) => sendEmailBestEffort("editorial-draft-notify", { to, subject: email.subject, html: email.html })),
  );

  return recipients.length;
}
