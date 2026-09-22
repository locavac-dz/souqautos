import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { computeAverageRating } from "@/lib/reviews";
import { numeric } from "@/lib/validation/search";
import { PRO_CATEGORIES, type ProCategory } from "@/lib/validation/pro-account";

// Lot 107 — annuaire des concessionnaires.
export const DIRECTORY_PAGE_SIZE = 12;

export const directoryParamsSchema = z.object({
  wilaya: z.string().trim().max(80).optional().catch(undefined),
  category: z.enum(PRO_CATEGORIES).optional().catch(undefined),
  page: numeric(),
});

export type DirectoryEntry = {
  id: string;
  nomCommercial: string;
  logoUrl: string | null;
  badgeVerifie: boolean;
  wilayaId: number | null;
  categoryPro: ProCategory | null;
  listingCount: number;
  ratingAverage: number;
  ratingCount: number;
};

type DirectoryAccount = {
  id: string;
  userId: string;
  nomCommercial: string;
  logoUrl: string | null;
  badgeVerifie: boolean;
  wilayaId: number | null;
  categoryPro: ProCategory | null;
};

// Seuls les comptes avec au moins une annonce publiée (donc modérée) sont
// listés : n'importe qui peut créer un compte pro sans contrôle, et l'annuaire
// est public et indexable.
export function assembleDirectoryEntries(input: {
  accounts: DirectoryAccount[];
  listingCounts: Map<string, number>;
  ratings: Map<string, number[]>;
}): DirectoryEntry[] {
  return input.accounts.flatMap((account) => {
    const listingCount = input.listingCounts.get(account.userId) ?? 0;
    if (listingCount === 0) return [];
    const { average, count } = computeAverageRating(input.ratings.get(account.id) ?? []);
    return [
      {
        id: account.id,
        nomCommercial: account.nomCommercial,
        logoUrl: account.logoUrl,
        badgeVerifie: account.badgeVerifie,
        wilayaId: account.wilayaId,
        categoryPro: account.categoryPro,
        listingCount,
        ratingAverage: average,
        ratingCount: count,
      },
    ];
  });
}

// Vérifiés d'abord (badge posé à la main après contrôle), puis plus grand
// stock, puis ordre alphabétique. Volontairement aucun avantage lié à
// l'abonnement : la page /professionnels ne promet pas de placement payant.
export function sortDirectoryEntries(entries: DirectoryEntry[]): DirectoryEntry[] {
  return [...entries].sort(
    (a, b) =>
      Number(b.badgeVerifie) - Number(a.badgeVerifie) ||
      b.listingCount - a.listingCount ||
      a.nomCommercial.localeCompare(b.nomCommercial)
  );
}

export function filterByWilaya(entries: DirectoryEntry[], wilayaId: number | undefined): DirectoryEntry[] {
  return wilayaId === undefined ? entries : entries.filter((e) => e.wilayaId === wilayaId);
}

export function filterByCategory(entries: DirectoryEntry[], category: ProCategory | undefined): DirectoryEntry[] {
  return category === undefined ? entries : entries.filter((e) => e.categoryPro === category);
}

export function countByWilaya(entries: DirectoryEntry[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const entry of entries) {
    if (entry.wilayaId === null) continue;
    counts.set(entry.wilayaId, (counts.get(entry.wilayaId) ?? 0) + 1);
  }
  return counts;
}

// La pagination vit dans `@/lib/pagination` depuis le Lot 110 (partagée avec les
// essais) ; ré-exportée ici pour ne pas changer les imports existants.
export { paginate } from "@/lib/pagination";

// Requêtes batchées (jamais une par compte). Volontairement sans `include:
// { user }` : le téléphone est chiffré en base et n'a rien à faire dans le HTML
// d'une page publique.
export async function getDirectoryEntries(): Promise<DirectoryEntry[]> {
  const accounts = await prisma.professionalAccount.findMany({
    select: { id: true, userId: true, nomCommercial: true, logoUrl: true, badgeVerifie: true, wilayaId: true, categoryPro: true },
  });
  if (accounts.length === 0) return [];

  const [counts, reviews] = await Promise.all([
    prisma.listing.groupBy({
      by: ["sellerId"],
      where: { status: "PUBLIEE", sellerId: { in: accounts.map((a) => a.userId) } },
      _count: true,
    }),
    prisma.review.findMany({
      where: { professionalAccountId: { in: accounts.map((a) => a.id) } },
      select: { professionalAccountId: true, rating: true },
    }),
  ]);

  const ratings = new Map<string, number[]>();
  for (const review of reviews) {
    if (!review.professionalAccountId) continue;
    const list = ratings.get(review.professionalAccountId) ?? [];
    list.push(review.rating);
    ratings.set(review.professionalAccountId, list);
  }

  return assembleDirectoryEntries({
    accounts,
    listingCounts: new Map(counts.map((c) => [c.sellerId, c._count])),
    ratings,
  });
}
