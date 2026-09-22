import { prisma } from "@/lib/prisma";

export type PriceStats = {
  count: number;
  avgPrice: number | null;
  minPrice: number | null;
  maxPrice: number | null;
};

export async function getListingStats(where: {
  brandId?: number;
  modelId?: number;
  wilayaId?: number;
}): Promise<PriceStats> {
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
export async function getListingCountsPerBrand(): Promise<Map<number, BrandCount>> {
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
export async function getListingCountsPerWilaya(): Promise<Map<number, WilayaListingCount>> {
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

export async function getModelCountsForBrand(brandId: number): Promise<Map<number, ModelCount>> {
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
export async function getModelPriceHistory({
  brandId,
  modelId,
}: {
  brandId: number;
  modelId: number;
}): Promise<MonthPoint[]> {
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

export type WilayaBrandCount = { brandId: number; count: number; minPrice: number | null };

// Lot 75 — mêmes conventions que getModelCountsForBrand (une seule requête
// groupée, pas de N+1) pour la page wilaya : les marques les plus proposées
// dans cette wilaya précisément, pas un classement national.
export async function getBrandCountsForWilaya(wilayaId: number): Promise<Map<number, WilayaBrandCount>> {
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
