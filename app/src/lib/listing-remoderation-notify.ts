import { parseAlertEmails } from "@/lib/alert-recipients";
import { sendEmailBestEffort, escapeHtml } from "@/lib/mailer";
import { SITE_URL } from "@/lib/site";
import type { RemoderationResult, FlaggedListing } from "@/lib/listing-remoderation-sweep";
import type { FraudSignals } from "@/lib/fraud-signals";

const SIGNAL_LABELS: Record<keyof FraudSignals, string> = {
  duplicatePhoto: "Photo dupliquée",
  duplicateContent: "Contenu dupliqué",
  duplicateVin: "VIN dupliqué",
  lowPrice: "Prix anormalement bas",
  vehicleInconsistency: "Incohérence véhicule",
  sellerRejectionHistory: "Historique vendeur",
};

export function resolveRemoderationRecipients(env: Record<string, string | undefined>): string[] {
  return parseAlertEmails(env.STAFF_ALERT_EMAILS);
}

export function buildRemoderationEmail(result: RemoderationResult): { subject: string; html: string } | null {
  if (result.flagged.length === 0) return null;

  const count = result.flagged.length;
  const subject = `souqautos.com — ${count} annonce${count > 1 ? "s" : ""} publiée${count > 1 ? "s" : ""} avec nouveaux signaux`;

  const adminUrl = `${SITE_URL}/fr/admin/annonces`;
  const rows = result.flagged
    .map(
      (f) =>
        `<li><a href="${escapeHtml(adminUrl)}">${escapeHtml(f.title)}</a> — score ${f.oldScore} → ${f.newScore} (${f.signals.map((s) => SIGNAL_LABELS[s]).join(", ")})</li>`,
    )
    .join("");

  const html = `<p>Le balayage de re-modération a vérifié ${result.checked} annonce${result.checked > 1 ? "s" : ""} publiée${result.checked > 1 ? "s" : ""} et détecté ${count} avec de nouveaux signaux de fraude :</p>
<ul>${rows}</ul>
<p>Ces annonces sont <strong>toujours publiées</strong>. Vérifiez-les dans l'administration et suspendez-les si nécessaire.</p>`;

  return { subject, html };
}

export async function notifyRemoderationFlags(result: RemoderationResult): Promise<number> {
  const email = buildRemoderationEmail(result);
  if (!email) return 0;

  const recipients = resolveRemoderationRecipients(process.env);
  if (recipients.length === 0) return 0;

  await Promise.all(
    recipients.map((to) => sendEmailBestEffort("remoderation-sweep", { to, subject: email.subject, html: email.html })),
  );

  return recipients.length;
}
