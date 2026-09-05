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
