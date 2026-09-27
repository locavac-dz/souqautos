import { prisma } from "@/lib/prisma";
import { createTtlBatchCache } from "@/lib/ttl-cache";

// Lot 227 — les agrégats du catalogue (comptes, prix moyens, historiques) sont gardés en mémoire une heure : la CSP à nonce
// (src/proxy.ts) impose un rendu par requête, donc pas d'ISR ; le cache porte sur les données. Une annonce publiée ou retirée
// met donc jusqu'à une heure à changer ces chiffres. CATALOGUE_STATS_CACHE_TTL_MS règle la durée ; 0 désactive le cache (tests
// de bout en bout, qui créent des annonces puis lisent tout de suite les compteurs).
export const CATALOGUE_STATS_CACHE_TTL_MS = 60 * 60 * 1000;
export const CATALOGUE_STATS_CACHE_MAX_ENTRIES = 5000;

function cacheTtl(): number {
  const raw = process.env.CATALOGUE_STATS_CACHE_TTL_MS;
  if (raw === undefined || raw.trim() === "") return CATALOGUE_STATS_CACHE_TTL_MS;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : CATALOGUE_STATS_CACHE_TTL_MS;
}

const statsCache = createTtlBatchCache<unknown>({
  name: "catalogue-stats",
  maxEntries: CATALOGUE_STATS_CACHE_MAX_ENTRIES,
  ttlMs: cacheTtl,
});

async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const found = await statsCache.getMany([key], async () => new Map([[key, await load()]]));
  return found.get(key) as T;
}

export type PriceStats = {
  count: number;
  avgPrice: number | null;
  minPrice: number | null;
  maxPrice: number | null;
};

export function getListingStats(where: { brandId?: number; modelId?: number; wilayaId?: number }): Promise<PriceStats> {
  return cached(`stats:${where.brandId ?? ""}:${where.modelId ?? ""}:${where.wilayaId ?? ""}`, () => loadListingStats(where));
}

async function loadListingStats(where: { brandId?: number; modelId?: number; wilayaId?: number }): Promise<PriceStats> {
  const agg = await prisma.listing.aggregate({
    where: { ...where, status: "PUBLIEE" },
    _count: true,
    _avg: { price: true },
    _min: { price: true },
    _max: { price: true },
  });

  return {
    count: agg._count,
    avgPrice: agg._avg.price !== null ? Math.round(agg._avg.price) : null,
    minPrice: agg._min.price,
    maxPrice: agg._max.price,
  };
}

export type BrandCount = { brandId: number; count: number; avgPrice: number | null };

// Une seule requête groupée pour toutes les marques (pas une requête par
// marque) — évite un N+1 sur la page d'index des marques.
export function getListingCountsPerBrand(): Promise<Map<number, BrandCount>> {
  return cached("counts:brands", loadListingCountsPerBrand);
}

async function loadListingCountsPerBrand(): Promise<Map<number, BrandCount>> {
  const groups = await prisma.listing.groupBy({
    by: ["brandId"],
    where: { status: "PUBLIEE", brandId: { not: null } },
    _count: true,
    _avg: { price: true },
  });

  return new Map(
    groups
      .filter((g): g is typeof g & { brandId: number } => g.brandId !== null)
      .map((g) => [
        g.brandId,
        { brandId: g.brandId, count: g._count, avgPrice: g._avg.price !== null ? Math.round(g._avg.price) : null },
      ])
  );
}

export type WilayaListingCount = { wilayaId: number; count: number; avgPrice: number | null };

// Lot 75 — même principe que getListingCountsPerBrand (une seule requête
// groupée) pour l'index /wilaya.
export function getListingCountsPerWilaya(): Promise<Map<number, WilayaListingCount>> {
  return cached("counts:wilayas", loadListingCountsPerWilaya);
}

async function loadListingCountsPerWilaya(): Promise<Map<number, WilayaListingCount>> {
  const groups = await prisma.listing.groupBy({
    by: ["wilayaId"],
    where: { status: "PUBLIEE" },
    _count: true,
    _avg: { price: true },
  });

  return new Map(
    groups.map((g) => [
      g.wilayaId,
      { wilayaId: g.wilayaId, count: g._count, avgPrice: g._avg.price !== null ? Math.round(g._avg.price) : null },
    ])
  );
}

export type ModelCount = { modelId: number; count: number; minPrice: number | null };

export function getModelCountsForBrand(brandId: number): Promise<Map<number, ModelCount>> {
  return cached(`counts:brand:${brandId}:models`, () => loadModelCountsForBrand(brandId));
}

async function loadModelCountsForBrand(brandId: number): Promise<Map<number, ModelCount>> {
  const groups = await prisma.listing.groupBy({
    by: ["modelId"],
    where: { brandId, status: "PUBLIEE", modelId: { not: null } },
    _count: true,
    _min: { price: true },
  });

  return new Map(
    groups
      .filter((g): g is typeof g & { modelId: number } => g.modelId !== null)
      .map((g) => [g.modelId, { modelId: g.modelId, count: g._count, minPrice: g._min.price }])
  );
}

export type MonthPoint = { month: string; avgPrice: number; count: number };

// Lot 164 — évolution du prix moyen mensuel pour un modèle sur les 12 derniers mois.
// Retourne uniquement les mois avec au moins 2 annonces (évite les valeurs aberrantes).
export function getModelPriceHistory(args: { brandId: number; modelId: number }): Promise<MonthPoint[]> {
  return cached(`history:${args.brandId}:${args.modelId}`, () => loadModelPriceHistory(args));
}

async function loadModelPriceHistory({ brandId, modelId }: { brandId: number; modelId: number }): Promise<MonthPoint[]> {
  const rows = await prisma.$queryRaw<{ month: string; avg_price: number; cnt: bigint }[]>`
    SELECT
      TO_CHAR(DATE_TRUNC('month', "createdAt"), 'YYYY-MM') AS month,
      ROUND(AVG(price))::integer                            AS avg_price,
      COUNT(*)                                              AS cnt
    FROM "Listing"
    WHERE "brandId" = ${brandId}
      AND "modelId" = ${modelId}
      AND status = 'PUBLIEE'
      AND "createdAt" >= NOW() - INTERVAL '12 months'
    GROUP BY DATE_TRUNC('month', "createdAt")
    ORDER BY DATE_TRUNC('month', "createdAt") ASC
  `;
  return rows
    .filter((r) => Number(r.cnt) >= 2)
    .map((r) => ({ month: r.month, avgPrice: Number(r.avg_price), count: Number(r.cnt) }));
}

export type ModelYearStats = {
  count: number;
  p25: number | null;
  p75: number | null;
};

// Lot 172 — fourchette de prix P25–P75 pour un modèle ET une année donnée, sur les
// annonces actuellement en ligne. Utilisé par MarketStatsWidget sur la page annonce.
// Minimum 3 annonces pour retourner une fourchette (en dessous, les percentiles sont
// trop instables pour être présentés à un acheteur comme une référence de marché).
export function getModelYearStats(args: { brandId: number; modelId: number; year: number }): Promise<ModelYearStats> {
  return cached(`year:${args.brandId}:${args.modelId}:${args.year}`, () => loadModelYearStats(args));
}

async function loadModelYearStats({
  brandId,
  modelId,
  year,
}: {
  brandId: number;
  modelId: number;
  year: number;
}): Promise<ModelYearStats> {
  const rows = await prisma.$queryRaw<{ cnt: bigint; p25: number | null; p75: number | null }[]>`
    SELECT
      COUNT(*)                                                                AS cnt,
      PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY price)::integer           AS p25,
      PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY price)::integer           AS p75
    FROM "Listing"
    WHERE "brandId" = ${brandId}
      AND "modelId" = ${modelId}
      AND year     = ${year}
      AND status   = 'PUBLIEE'
  `;
  const row = rows[0];
  const cnt = Number(row?.cnt ?? 0);
  if (cnt < 3) return { count: cnt, p25: null, p75: null };
  return {
    count: cnt,
    p25: row?.p25 !== null && row?.p25 !== undefined ? Math.round(Number(row.p25)) : null,
    p75: row?.p75 !== null && row?.p75 !== undefined ? Math.round(Number(row.p75)) : null,
  };
}

export type WilayaBrandCount = { brandId: number; count: number; minPrice: number | null };

// Lot 75 — mêmes conventions que getModelCountsForBrand (une seule requête
// groupée, pas de N+1) pour la page wilaya : les marques les plus proposées
// dans cette wilaya précisément, pas un classement national.
export function getBrandCountsForWilaya(wilayaId: number): Promise<Map<number, WilayaBrandCount>> {
  return cached(`counts:wilaya:${wilayaId}:brands`, () => loadBrandCountsForWilaya(wilayaId));
}

async function loadBrandCountsForWilaya(wilayaId: number): Promise<Map<number, WilayaBrandCount>> {
  const groups = await prisma.listing.groupBy({
    by: ["brandId"],
    where: { wilayaId, status: "PUBLIEE", brandId: { not: null } },
    _count: true,
    _min: { price: true },
  });

  return new Map(
    groups
      .filter((g): g is typeof g & { brandId: number } => g.brandId !== null)
      .map((g) => [g.brandId, { brandId: g.brandId, count: g._count, minPrice: g._min.price }])
  );
}
