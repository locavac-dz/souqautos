import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { escapeHtml, sendEmail } from "@/lib/mailer";
import { SITE_URL } from "@/lib/site";

// Lot 118 — prévient l'équipe de modération quand du contenu attend une décision
// (annonce, avis de propriétaire, demande de vérification d'identité, signalement).
//
// Sans cela, un contenu en attente n'était vu que si quelqu'un ouvrait le
// back-office : une annonce déposée un vendredi soir attendait le lundi.
//
// Un courriel par type d'événement et par fenêtre de 30 minutes au plus : une
// rafale de dépôts ne noie pas la boîte de l'équipe. Le courriel donne l'état
// de TOUTE la file (pas seulement l'événement déclencheur), avec les liens.
// Destinataires : STAFF_ALERT_EMAILS (adresses séparées par des virgules) ;
// non défini = aucune alerte (comportement d'avant ce lot).

export type StaffAlertKind = "listing" | "ownerReview" | "identity" | "report";

export const STAFF_ALERT_WINDOW_MS = 30 * 60 * 1000;
export const MAX_STAFF_RECIPIENTS = 10;

export type PendingCounts = {
  listings: number;
  ownerReviews: number;
  identityRequests: number;
  reports: number;
};

const EMAIL_SHAPE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/;

export function parseStaffEmails(raw: string | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  for (const part of raw.split(/[,;]/)) {
    const email = part.trim().toLowerCase();
    if (EMAIL_SHAPE.test(email)) seen.add(email);
  }
  return [...seen].slice(0, MAX_STAFF_RECIPIENTS);
}

export function totalPending(counts: PendingCounts): number {
  return counts.listings + counts.ownerReviews + counts.identityRequests + counts.reports;
}

// Groupe nominal complet, accordé : « nouvel avis », « nouveau signalement »…
const NEW_ITEM_LABEL: Record<StaffAlertKind, string> = {
  listing: "nouvelle annonce",
  ownerReview: "nouvel avis de propriétaire",
  identity: "nouvelle demande de vérification d'identité",
  report: "nouveau signalement",
};

// Lignes de la file, chacune avec son lien : la file entière est rappelée, la
// ligne du type déclencheur est mise en tête.
export function buildStaffAlertEmail({
  kind,
  counts,
  siteUrl,
}: {
  kind: StaffAlertKind;
  counts: PendingCounts;
  siteUrl: string;
}): { subject: string; html: string } {
  const base = siteUrl.replace(/\/$/, "");
  const rows: { key: StaffAlertKind; label: string; count: number; path: string }[] = [
    { key: "listing", label: "Annonces à valider", count: counts.listings, path: "/fr/admin/annonces" },
    { key: "ownerReview", label: "Avis de propriétaires à valider", count: counts.ownerReviews, path: "/fr/admin/avis-proprietaires" },
    { key: "identity", label: "Vérifications d'identité en attente", count: counts.identityRequests, path: "/fr/admin/identite" },
    { key: "report", label: "Signalements ouverts", count: counts.reports, path: "/fr/admin/signalements" },
  ];
  rows.sort((a, b) => Number(b.key === kind) - Number(a.key === kind));

  const total = totalPending(counts);
  const subject = `[Souq Auto] Modération : ${NEW_ITEM_LABEL[kind]} — ${total} élément${total > 1 ? "s" : ""} en attente`;
  const items = rows
    .filter((row) => row.count > 0 || row.key === kind)
    .map((row) => `<li><a href="${escapeHtml(base + row.path)}">${escapeHtml(row.label)}</a> : <strong>${row.count}</strong></li>`)
    .join("");
  const html =
    `<p>Bonjour,</p>` +
    `<p>À traiter : ${escapeHtml(NEW_ITEM_LABEL[kind])}. État de la file de modération :</p>` +
    `<ul>${items}</ul>` +
    `<p style="color:#64748b;font-size:12px">Ce message n'est envoyé qu'une fois par type d'événement toutes les 30 minutes.</p>`;
  return { subject, html };
}

async function readPendingCounts(): Promise<PendingCounts> {
  const [listings, ownerReviews, identityRequests, reports] = await Promise.all([
    prisma.listing.count({ where: { status: "EN_ATTENTE" } }),
    prisma.ownerReview.count({ where: { status: "EN_ATTENTE" } }),
    prisma.identityVerificationRequest.count({ where: { status: "EN_ATTENTE" } }),
    prisma.report.count({ where: { status: "OUVERT" } }),
  ]);
  return { listings, ownerReviews, identityRequests, reports };
}

// À appeler APRÈS la réponse (avec `after()` de Next) : n'allonge pas la requête de
// l'utilisateur. Ne lève jamais d'exception : une alerte qui échoue ne doit
// affecter ni le dépôt du contenu ni le reste de l'application.
export async function notifyStaffOfPending(kind: StaffAlertKind): Promise<void> {
  try {
    const recipients = parseStaffEmails(process.env.STAFF_ALERT_EMAILS);
    if (recipients.length === 0) return;

    if (!(await checkRateLimit(`staff-alert:${kind}`, { limit: 1, windowMs: STAFF_ALERT_WINDOW_MS }))) return;

    const { subject, html } = buildStaffAlertEmail({ kind, counts: await readPendingCounts(), siteUrl: SITE_URL });
    await Promise.all(
      recipients.map(async (to) => {
        const result = await sendEmail({ to, subject, html }).catch((err) => {
          console.error(`[alerte équipe] échec d'envoi à ${to}: ${(err as Error).message}`);
          return null;
        });
        if (result?.previewUrl) console.log(`[alerte équipe] ${result.previewUrl}`);
      })
    );
  } catch (error) {
    console.error(`[alerte équipe] ${(error as Error).message}`);
  }
}
