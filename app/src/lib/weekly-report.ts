// Lot 275 — rapport hebdomadaire automatique : les chiffres du point du lundi, envoyés à l'équipe par le balayage
// nocturne, une seule fois par semaine complète (lundi 00:00 → lundi 00:00 suivant), comparés à la semaine
// précédente, et conservés (WeeklyReport) pour relecture dans /admin/rapports.
//
// Volontairement sans next-intl : le rapport est interne (français) et doit pouvoir être produit hors d'une
// requête Next (script d'exploitation, test).
import { prisma } from "@/lib/prisma";
import { escapeHtml, sendEmailBestEffort } from "@/lib/mailer";
import { parseAlertEmails } from "@/lib/alert-recipients";
import { formatNumber } from "@/lib/format";
import { SITE_URL } from "@/lib/site";

const DAY_MS = 24 * 60 * 60 * 1000;
const EXPIRING_WINDOW_DAYS = 15;

export type WeekPeriod = { start: Date; end: Date };

// Semaine complète la plus récente : du lundi 00:00 (heure du serveur) au lundi 00:00 suivant, `end` ≤ now.
export function lastCompleteWeek(now: Date): WeekPeriod {
  const thisMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekday = (thisMonday.getDay() + 6) % 7; // lundi = 0
  thisMonday.setDate(thisMonday.getDate() - weekday);
  const start = new Date(thisMonday);
  start.setDate(start.getDate() - 7);
  return { start, end: thisMonday };
}

export function previousWeek(period: WeekPeriod): WeekPeriod {
  const start = new Date(period.start);
  start.setDate(start.getDate() - 7);
  return { start, end: period.start };
}

export type WeeklyMetrics = {
  // Activité de la semaine
  listingsSubmitted: number;
  listingsPublished: number;
  listingsAutoPublished: number;
  listingsRejected: number;
  moderationMedianHours: number | null;
  newUsers: number;
  newProAccounts: number;
  paymentsConfirmedCount: number;
  paymentsConfirmedAmountDzd: number;
  offers: number;
  conversations: number;
  messages: number;
  reportsOpened: number;
  reportsResolved: number;
  contactsReceived: number;
  contactsAnswered: number;
  listingViews: number;
  pageViews: number;
  // État au moment du rapport
  pendingNow: number;
  oldestPendingHours: number | null;
  reportsOpenNow: number;
  contactsOpenNow: number;
  activePaidSubscriptions: number;
  subscriptionsExpiringSoon: number;
  pendingTransfersCount: number;
  pendingTransfersAmountDzd: number;
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export async function collectWeeklyMetrics(period: WeekPeriod, now: Date): Promise<WeeklyMetrics> {
  const inPeriod = { gte: period.start, lt: period.end };
  const dayStart = new Date(Date.UTC(period.start.getFullYear(), period.start.getMonth(), period.start.getDate()));
  const dayEnd = new Date(Date.UTC(period.end.getFullYear(), period.end.getMonth(), period.end.getDate()));
  const expiringHorizon = new Date(now.getTime() + EXPIRING_WINDOW_DAYS * DAY_MS);
  const pendingTransfer = { provider: "VIREMENT" as const, status: "EN_ATTENTE" as const };
  const confirmed = { status: "CONFIRMEE" as const, reviewedAt: inPeriod };

  const [
    listingsSubmitted, listingsPublished, listingsAutoPublished, listingsRejected, humanPublished,
    newUsers, newProAccounts, confirmedListingOrders, confirmedProOrders,
    offers, conversations, messages, reportsOpened, reportsResolved, contactsReceived, contactsAnswered,
    listingViews, pageViews,
    pendingNow, oldestPending, reportsOpenNow, contactsOpenNow, activePaidSubscriptions, subscriptionsExpiringSoon,
    pendingListingTransfers, pendingProTransfers,
  ] = await Promise.all([
    prisma.listing.count({ where: { createdAt: inPeriod, status: { not: "BROUILLON" } } }),
    prisma.listing.count({ where: { publishedAt: inPeriod } }),
    prisma.listing.count({ where: { autoPublishedAt: inPeriod } }),
    prisma.auditLog.count({ where: { action: "listing.reject", createdAt: inPeriod } }),
    prisma.listing.findMany({ where: { publishedAt: inPeriod, autoPublishedAt: null }, select: { createdAt: true, publishedAt: true }, take: 500 }),
    prisma.user.count({ where: { createdAt: inPeriod } }),
    prisma.professionalAccount.count({ where: { createdAt: inPeriod } }),
    prisma.paymentOrder.aggregate({ where: confirmed, _count: { _all: true }, _sum: { amountDzd: true } }),
    prisma.proSubscriptionOrder.aggregate({ where: confirmed, _count: { _all: true }, _sum: { amountDzd: true } }),
    prisma.offer.count({ where: { createdAt: inPeriod } }),
    prisma.conversation.count({ where: { createdAt: inPeriod } }),
    prisma.message.count({ where: { createdAt: inPeriod } }),
    prisma.report.count({ where: { createdAt: inPeriod } }),
    prisma.report.count({ where: { resolvedAt: inPeriod } }),
    prisma.contactMessage.count({ where: { createdAt: inPeriod } }),
    prisma.contactMessage.count({ where: { answeredAt: inPeriod } }),
    prisma.listingViewDay.aggregate({ where: { day: { gte: dayStart, lt: dayEnd } }, _sum: { count: true } }),
    prisma.pageViewDay.aggregate({ where: { day: { gte: dayStart, lt: dayEnd } }, _sum: { count: true } }),
    prisma.listing.count({ where: { status: "EN_ATTENTE" } }),
    prisma.listing.findFirst({ where: { status: "EN_ATTENTE" }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    prisma.report.count({ where: { status: "OUVERT" } }),
    prisma.contactMessage.count({ where: { status: { in: ["NOUVEAU", "PRIS_EN_CHARGE"] } } }),
    prisma.proSubscription.count({ where: { tier: { not: "STARTER" }, expiresAt: { gt: now } } }),
    prisma.proSubscription.count({ where: { tier: { not: "STARTER" }, expiresAt: { gt: now, lte: expiringHorizon } } }),
    prisma.paymentOrder.aggregate({ where: pendingTransfer, _count: { _all: true }, _sum: { amountDzd: true } }),
    prisma.proSubscriptionOrder.aggregate({ where: pendingTransfer, _count: { _all: true }, _sum: { amountDzd: true } }),
  ]);

  const delays = humanPublished
    .filter((l) => l.publishedAt)
    .map((l) => (l.publishedAt!.getTime() - l.createdAt.getTime()) / 3_600_000);

  return {
    listingsSubmitted,
    listingsPublished,
    listingsAutoPublished,
    listingsRejected,
    moderationMedianHours: median(delays),
    newUsers,
    newProAccounts,
    paymentsConfirmedCount: confirmedListingOrders._count._all + confirmedProOrders._count._all,
    paymentsConfirmedAmountDzd: (confirmedListingOrders._sum.amountDzd ?? 0) + (confirmedProOrders._sum.amountDzd ?? 0),
    offers,
    conversations,
    messages,
    reportsOpened,
    reportsResolved,
    contactsReceived,
    contactsAnswered,
    listingViews: listingViews._sum.count ?? 0,
    pageViews: pageViews._sum.count ?? 0,
    pendingNow,
    oldestPendingHours: oldestPending ? Math.round((now.getTime() - oldestPending.createdAt.getTime()) / 3_600_000) : null,
    reportsOpenNow,
    contactsOpenNow,
    activePaidSubscriptions,
    subscriptionsExpiringSoon,
    pendingTransfersCount: pendingListingTransfers._count._all + pendingProTransfers._count._all,
    pendingTransfersAmountDzd: (pendingListingTransfers._sum.amountDzd ?? 0) + (pendingProTransfers._sum.amountDzd ?? 0),
  };
}

// Évolution d'une semaine à l'autre, pour un humain pressé : « +12 % », « −5 % », « = », « nouveau », « — ».
export function formatDelta(current: number, previous: number): string {
  if (previous === 0) return current === 0 ? "—" : "nouveau";
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return "=";
  return `${pct > 0 ? "+" : "−"}${Math.abs(pct)} %`;
}

function dateLabel(d: Date): string {
  return new Intl.DateTimeFormat("fr-DZ", { dateStyle: "long" }).format(d);
}

// Le dimanche de la semaine (fin exclusive − 1 jour), pour un libellé « du lundi 1 au dimanche 7 ».
function inclusiveEnd(period: WeekPeriod): Date {
  return new Date(period.end.getTime() - DAY_MS);
}

type Row = { label: string; current: number | null; previous: number | null; unit?: string };

export function buildWeeklyReportEmail(input: {
  period: WeekPeriod;
  current: WeeklyMetrics;
  previous: WeeklyMetrics;
  siteUrl: string;
}): { subject: string; html: string } {
  const { period, current: c, previous: p } = input;
  const n = (v: number) => formatNumber(v, "fr");
  const h = (v: number | null) => (v === null ? "—" : `${n(Math.round(v))} h`);

  const activity: Row[] = [
    { label: "Annonces soumises", current: c.listingsSubmitted, previous: p.listingsSubmitted },
    { label: "Annonces publiées", current: c.listingsPublished, previous: p.listingsPublished },
    { label: "  dont publiées automatiquement", current: c.listingsAutoPublished, previous: p.listingsAutoPublished },
    { label: "Annonces refusées", current: c.listingsRejected, previous: p.listingsRejected },
    { label: "Nouveaux comptes", current: c.newUsers, previous: p.newUsers },
    { label: "Nouveaux comptes pro", current: c.newProAccounts, previous: p.newProAccounts },
    { label: "Paiements confirmés", current: c.paymentsConfirmedCount, previous: p.paymentsConfirmedCount },
    { label: "Montant encaissé", current: c.paymentsConfirmedAmountDzd, previous: p.paymentsConfirmedAmountDzd, unit: " DA" },
    { label: "Offres de prix", current: c.offers, previous: p.offers },
    { label: "Conversations ouvertes", current: c.conversations, previous: p.conversations },
    { label: "Messages échangés", current: c.messages, previous: p.messages },
    { label: "Signalements reçus", current: c.reportsOpened, previous: p.reportsOpened },
    { label: "Signalements traités", current: c.reportsResolved, previous: p.reportsResolved },
    { label: "Messages de contact reçus", current: c.contactsReceived, previous: p.contactsReceived },
    { label: "Messages de contact répondus", current: c.contactsAnswered, previous: p.contactsAnswered },
    { label: "Vues d'annonces", current: c.listingViews, previous: p.listingViews },
    { label: "Pages vues (site public)", current: c.pageViews, previous: p.pageViews },
  ];

  const td = 'style="padding:4px 10px;border-bottom:1px solid #e2e8f0"';
  const num = 'style="padding:4px 10px;border-bottom:1px solid #e2e8f0;text-align:right;white-space:nowrap"';
  const rows = activity
    .map(
      (r) =>
        `<tr><td ${td}>${escapeHtml(r.label)}</td><td ${num}>${n(r.current ?? 0)}${r.unit ?? ""}</td><td ${num}>${n(r.previous ?? 0)}${r.unit ?? ""}</td><td ${num}>${formatDelta(r.current ?? 0, r.previous ?? 0)}</td></tr>`
    )
    .join("");

  const state = [
    ["Annonces en attente de modération", `${n(c.pendingNow)}${c.oldestPendingHours !== null ? ` (la plus ancienne : ${h(c.oldestPendingHours)})` : ""}`],
    ["Délai médian de validation humaine (semaine)", h(c.moderationMedianHours)],
    ["Signalements ouverts", n(c.reportsOpenNow)],
    ["Messages de contact à traiter", n(c.contactsOpenNow)],
    ["Abonnements pro payants actifs", `${n(c.activePaidSubscriptions)} (dont ${n(c.subscriptionsExpiringSoon)} expirent sous ${EXPIRING_WINDOW_DAYS} jours)`],
    ["Virements en attente", `${n(c.pendingTransfersCount)} (${n(c.pendingTransfersAmountDzd)} DA)`],
  ]
    .map(([label, value]) => `<tr><td ${td}>${escapeHtml(label)}</td><td ${num}>${escapeHtml(value)}</td></tr>`)
    .join("");

  const title = `Rapport hebdomadaire — du ${dateLabel(period.start)} au ${dateLabel(inclusiveEnd(period))}`;
  const html =
    `<h2 style="font-family:Arial,sans-serif">${escapeHtml(title)}</h2>` +
    `<h3 style="font-family:Arial,sans-serif">Activité de la semaine</h3>` +
    `<table style="font-family:Arial,sans-serif;font-size:14px;border-collapse:collapse"><thead><tr><th ${td}></th><th ${num}>Cette semaine</th><th ${num}>Semaine précédente</th><th ${num}>Évolution</th></tr></thead><tbody>${rows}</tbody></table>` +
    `<h3 style="font-family:Arial,sans-serif">État au lundi matin</h3>` +
    `<table style="font-family:Arial,sans-serif;font-size:14px;border-collapse:collapse"><tbody>${state}</tbody></table>` +
    `<p style="font-family:Arial,sans-serif;font-size:13px"><a href="${input.siteUrl}/fr/admin">Ouvrir le back-office</a> · <a href="${input.siteUrl}/fr/admin/prospection">Liste de prospection</a> · <a href="${input.siteUrl}/fr/admin/rapports">Rapports précédents</a></p>`;

  return { subject: `[Souq Autos] ${title}`, html };
}

// Équipe (STAFF_ALERT_EMAILS) + PDG (ADMIN_EMAIL), sans doublon.
export function resolveWeeklyReportRecipients(env: Record<string, string | undefined>): string[] {
  const staff = parseAlertEmails(env.STAFF_ALERT_EMAILS);
  const admin = parseAlertEmails(env.ADMIN_EMAIL);
  return [...new Set([...staff, ...admin])];
}

export type WeeklyReportResult =
  | { status: "sent"; periodStart: string; recipients: number }
  | { status: "already_sent"; periodStart: string }
  | { status: "no_recipients"; periodStart: string };

export async function sendWeeklyReport(now: Date, options: { force?: boolean } = {}): Promise<WeeklyReportResult> {
  const period = lastCompleteWeek(now);
  const periodStart = period.start.toISOString();

  if (!options.force) {
    const existing = await prisma.weeklyReport.findUnique({ where: { periodStart: period.start }, select: { id: true } });
    if (existing) return { status: "already_sent", periodStart };
  }

  const recipients = resolveWeeklyReportRecipients(process.env);
  if (recipients.length === 0) return { status: "no_recipients", periodStart };

  const [current, previous] = await Promise.all([collectWeeklyMetrics(period, now), collectWeeklyMetrics(previousWeek(period), now)]);
  const email = buildWeeklyReportEmail({ period, current, previous, siteUrl: SITE_URL });

  await Promise.all(recipients.map((to) => sendEmailBestEffort("rapport hebdomadaire", { to, subject: email.subject, html: email.html })));

  await prisma.weeklyReport.upsert({
    where: { periodStart: period.start },
    create: { periodStart: period.start, periodEnd: period.end, sentAt: now, recipients: recipients.join(", "), payload: { current, previous } },
    update: { sentAt: now, recipients: recipients.join(", "), payload: { current, previous } },
  });

  return { status: "sent", periodStart, recipients: recipients.length };
}

// Pour le balayage nocturne : envoie si la dernière semaine complète n'a pas encore son rapport. Ne lève jamais.
export async function sendWeeklyReportIfDue(now: Date = new Date()): Promise<WeeklyReportResult | { status: "error" }> {
  try {
    return await sendWeeklyReport(now);
  } catch (err) {
    console.error(`[rapport hebdomadaire] échec : ${(err as Error).message}`);
    return { status: "error" };
  }
}
