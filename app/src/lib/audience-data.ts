import { prisma } from "@/lib/prisma";
import { buildDailySeries, windowDayKeys, type DayPoint } from "@/lib/pro-stats";

// Lot 124 — lecture des compteurs d'audience pour la page d'administration.

const DAY_MS = 24 * 60 * 60 * 1000;

export type CountRow = { label: string; count: number };

export type AudienceReport = {
  total: number;
  previousTotal: number;
  perDay: DayPoint[];
  pages: CountRow[];
  content: { page: string; detail: string; count: number }[];
  referrers: CountRow[];
  devices: CountRow[];
  locales: CountRow[];
};

// Variation en % par rapport à la période précédente de même durée, à l'unité ; `null` quand la
// période précédente est vide (un pourcentage n'aurait aucun sens).
export function percentChange(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

// Part de `part` dans `total`, en % à l'unité ; 0 quand il n'y a rien.
export function sharePercent(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

function sorted(rows: { label: string; count: number }[]): CountRow[] {
  return [...rows].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export async function loadAudience(days: number, now: Date = new Date()): Promise<AudienceReport> {
  const keys = windowDayKeys(days, now);
  const firstDay = new Date(`${keys[0]}T00:00:00.000Z`); // colonne DATE : minuit UTC de la date civile
  const previousFirstDay = new Date(firstDay.getTime() - days * DAY_MS);

  const inWindow = { day: { gte: firstDay } };
  const [byDay, byPage, byDetail, byReferrer, byDevice, byLocale, previous] = await Promise.all([
    prisma.pageViewDay.groupBy({ by: ["day"], where: inWindow, _sum: { count: true } }),
    prisma.pageViewDay.groupBy({ by: ["page"], where: inWindow, _sum: { count: true } }),
    prisma.pageViewDay.groupBy({ by: ["page", "detail"], where: { ...inWindow, detail: { not: "" } }, _sum: { count: true }, orderBy: { _sum: { count: "desc" } }, take: 20 }),
    prisma.pageViewDay.groupBy({ by: ["referrer"], where: inWindow, _sum: { count: true } }),
    prisma.pageViewDay.groupBy({ by: ["device"], where: inWindow, _sum: { count: true } }),
    prisma.pageViewDay.groupBy({ by: ["locale"], where: inWindow, _sum: { count: true } }),
    prisma.pageViewDay.aggregate({ where: { day: { gte: previousFirstDay, lt: firstDay } }, _sum: { count: true } }),
  ]);

  const perDayCounts = new Map(byDay.map((r) => [r.day.toISOString().slice(0, 10), r._sum.count ?? 0]));
  const perDay = buildDailySeries(keys, perDayCounts);

  return {
    total: perDay.reduce((sum, p) => sum + p.value, 0),
    previousTotal: previous._sum.count ?? 0,
    perDay,
    pages: sorted(byPage.map((g) => ({ label: g.page, count: g._sum.count ?? 0 }))),
    content: byDetail.map((r) => ({ page: r.page, detail: r.detail, count: r._sum.count ?? 0 })),
    referrers: sorted(byReferrer.map((g) => ({ label: g.referrer, count: g._sum.count ?? 0 }))),
    devices: sorted(byDevice.map((g) => ({ label: g.device, count: g._sum.count ?? 0 }))),
    locales: sorted(byLocale.map((g) => ({ label: g.locale, count: g._sum.count ?? 0 }))),
  };
}

// Adresse publique (sans la langue) d'un contenu d'après son modèle de page et son identifiant.
export function contentHref(page: string, detail: string): string | null {
  switch (page) {
    case "/mag/[slug]":
      return `/mag/${detail}`;
    case "/essais/[slug]":
      return `/essais/${detail}`;
    case "/voitures/[marque]":
    case "/voitures/[marque]/[modele]":
      return `/voitures/${detail}`;
    case "/wilaya/[wilaya]":
      return `/wilaya/${detail}`;
    default:
      return null;
  }
}
