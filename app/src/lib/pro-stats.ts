// Lot 122 — statistiques des professionnels : logique pure (dates, séries, taux), testée sans base.

// Les jours sont comptés en heure d'Algérie : UTC+1 toute l'année, sans heure d'été. Un décalage
// fixe suffit donc, et évite de dépendre des données de fuseaux horaires du serveur.
const ALGIERS_OFFSET_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export const STATS_RANGES = [7, 30, 90] as const;
export type StatsRange = (typeof STATS_RANGES)[number];
export const DEFAULT_STATS_RANGE: StatsRange = 30;

// `?jours=` vient de l'adresse : toute valeur inattendue retombe sur la période par défaut.
export function parseStatsRange(raw: string | string[] | undefined): StatsRange {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = Number(value);
  return (STATS_RANGES as readonly number[]).includes(parsed) ? (parsed as StatsRange) : DEFAULT_STATS_RANGE;
}

// Jour civil algérien d'un instant, au format AAAA-MM-JJ.
export function algiersDayKey(instant: Date): string {
  return new Date(instant.getTime() + ALGIERS_OFFSET_MS).toISOString().slice(0, 10);
}

// Les `days` derniers jours civils algériens, du plus ancien au jour de `now` inclus.
export function windowDayKeys(days: number, now: Date): string[] {
  const todayMidnightUtc = Date.parse(`${algiersDayKey(now)}T00:00:00.000Z`);
  const keys: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    keys.push(new Date(todayMidnightUtc - i * DAY_MS).toISOString().slice(0, 10));
  }
  return keys;
}

// Premier instant de la fenêtre : minuit (heure d'Algérie) du premier jour.
export function windowStart(days: number, now: Date): Date {
  const first = windowDayKeys(days, now)[0];
  return new Date(Date.parse(`${first}T00:00:00.000Z`) - ALGIERS_OFFSET_MS);
}

export type DayPoint = { day: string; value: number };

// Une valeur par jour de la fenêtre, 0 pour les jours sans événement ; les événements hors fenêtre
// sont ignorés.
export function buildDailySeries(keys: string[], counts: ReadonlyMap<string, number>): DayPoint[] {
  return keys.map((day) => ({ day, value: counts.get(day) ?? 0 }));
}

export function countByDay(instants: Date[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const instant of instants) {
    const key = algiersDayKey(instant);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

// Une annonce vue 3 fois et contactée 2 fois n'a pas « 67 % de taux de contact » : en dessous de ce
// nombre de vues, le pourcentage ne veut rien dire et n'est pas affiché.
export const MIN_VIEWS_FOR_RATE = 30;

// Part des vues qui ont mené à un contact (numéro demandé ou message), en % arrondi à 0,1.
// `null` quand il y a trop peu de vues.
export function contactRatePercent(views: number, contacts: number): number | null {
  if (!Number.isFinite(views) || views < MIN_VIEWS_FOR_RATE) return null;
  return Math.round((Math.min(contacts, views) / views) * 1000) / 10;
}

export type ListingStats = {
  listingId: string;
  views: number;
  favorites: number;
  phoneReveals: number;
  whatsappOpens: number;
  conversations: number;
};

// Les contacts directs d'une annonce : numéros demandés (appel, WhatsApp) et conversations ouvertes.
export function totalContacts(stats: Pick<ListingStats, "phoneReveals" | "whatsappOpens" | "conversations">): number {
  return stats.phoneReveals + stats.whatsappOpens + stats.conversations;
}

export function sumStats(all: ListingStats[]): Omit<ListingStats, "listingId"> {
  return all.reduce(
    (acc, s) => ({
      views: acc.views + s.views,
      favorites: acc.favorites + s.favorites,
      phoneReveals: acc.phoneReveals + s.phoneReveals,
      whatsappOpens: acc.whatsappOpens + s.whatsappOpens,
      conversations: acc.conversations + s.conversations,
    }),
    { views: 0, favorites: 0, phoneReveals: 0, whatsappOpens: 0, conversations: 0 }
  );
}

// Tri du tableau : les annonces qui suscitent le plus de contacts d'abord, puis le plus de vues.
export function sortListingStats(all: ListingStats[]): ListingStats[] {
  return [...all].sort((a, b) => totalContacts(b) - totalContacts(a) || b.views - a.views || a.listingId.localeCompare(b.listingId));
}
