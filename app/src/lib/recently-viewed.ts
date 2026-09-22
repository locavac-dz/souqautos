// Lot 151 — annonces récemment vues, stockées dans localStorage (100 % client, sans serveur)

export type RecentlyViewedEntry = {
  id: string;
  title: string;
  price: number;
  photo: string | null;
  brandLabel: string;
  modelLabel: string;
  year: number;
  wilayaNomFr: string;
  wilayaNomAr: string;
  viewedAt: number; // Date.now()
};

export const MAX_RECENTLY_VIEWED = 8;
const STORAGE_KEY = "sa_recently_viewed";

// Logique pure : déduplique par id, insère en tête, plafonne à MAX.
export function mergeEntry(
  existing: RecentlyViewedEntry[],
  entry: RecentlyViewedEntry
): RecentlyViewedEntry[] {
  return [entry, ...existing.filter((e) => e.id !== entry.id)].slice(0, MAX_RECENTLY_VIEWED);
}

function isValidEntry(x: unknown): x is RecentlyViewedEntry {
  if (typeof x !== "object" || x === null) return false;
  const e = x as Record<string, unknown>;
  return typeof e.id === "string" && typeof e.title === "string" && typeof e.price === "number";
}

export function getRecentlyViewed(): RecentlyViewedEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidEntry);
  } catch {
    return [];
  }
}

export function saveRecentlyViewed(entry: RecentlyViewedEntry): void {
  try {
    const next = mergeEntry(getRecentlyViewed(), entry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* localStorage indisponible (mode privé strict) */
  }
}
