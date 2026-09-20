import type { Prisma } from "@prisma/client";
import { PAGE_SIZE, type SearchParams, type SortOption } from "./validation/search";

// Include Prisma partagé par toute page/route qui affiche une carte
// d'annonce (ListingCard) — extrait de recherche/page.tsx (Lot 3) pour que
// le chat AI Advisor (Lot 89) réutilise exactement la même forme plutôt
// qu'un troisième littéral recopié à la main.
export const listingCardInclude = {
  brand: true,
  model: true,
  wilaya: true,
  commune: true,
  photos: { orderBy: { position: "asc" as const }, take: 1 },
  equipments: { select: { equipmentId: true } },
} satisfies Prisma.ListingInclude;

export type ListingWithCardRelations = Prisma.ListingGetPayload<{ include: typeof listingCardInclude }>;

// Lot 139 — marques, modèles et wilayas dont le NOM contient le mot cherché (cf. src/lib/search-query.ts).
export type CatalogueMatches = { brandIds: number[]; modelIds: number[]; wilayaIds: number[] };

// `catalogueMatches` (facultatif) : quand l'appelant a déjà cherché le mot dans le catalogue, la condition n'a plus besoin de
// joindre les tables de marques, modèles et wilayas — même résultat, sans jointure (et donc indexable). Sans lui, la forme
// d'origine (par relations) est conservée : c'est la RÉFÉRENCE dont le test d'équivalence vérifie que la forme rapide est identique.
export function buildListingWhere(params: SearchParams, catalogueMatches?: CatalogueMatches): Prisma.ListingWhereInput {
  const where: Prisma.ListingWhereInput = { status: "PUBLIEE" };

  if (params.q) {
    // PostgreSQL : `contains` est sensible à la casse sans `mode: "insensitive"`
    // (SQLite ne distinguait pas majuscules et minuscules). Aucun pliage des
    // accents dans un cas comme dans l'autre.
    const contains = { contains: params.q, mode: "insensitive" } as const;
    const clauses: Prisma.ListingWhereInput[] = [{ title: contains }, { brandFreeText: contains }, { modelFreeText: contains }];
    if (catalogueMatches) {
      if (catalogueMatches.brandIds.length > 0) clauses.push({ brandId: { in: catalogueMatches.brandIds } });
      if (catalogueMatches.modelIds.length > 0) clauses.push({ modelId: { in: catalogueMatches.modelIds } });
      if (catalogueMatches.wilayaIds.length > 0) clauses.push({ wilayaId: { in: catalogueMatches.wilayaIds } });
    } else {
      clauses.push({ brand: { name: contains } }, { model: { name: contains } }, { wilaya: { nomFr: contains } }, { wilaya: { nomAr: contains } });
    }
    where.OR = clauses;
  }

  if (params.category) where.category = params.category;
  if (params.brandId) where.brandId = params.brandId;
  if (params.modelId) where.modelId = params.modelId;
  if (params.wilayaId) where.wilayaId = params.wilayaId;
  if (params.communeId) where.communeId = params.communeId;
  if (params.fuelType) where.fuelType = params.fuelType;
  if (params.gearbox) where.gearbox = params.gearbox;
  if (params.condition) where.condition = params.condition;

  if (params.priceMin || params.priceMax) {
    where.price = {
      ...(params.priceMin ? { gte: params.priceMin } : {}),
      ...(params.priceMax ? { lte: params.priceMax } : {}),
    };
  }

  if (params.yearMin || params.yearMax) {
    where.year = {
      ...(params.yearMin ? { gte: params.yearMin } : {}),
      ...(params.yearMax ? { lte: params.yearMax } : {}),
    };
  }

  if (params.mileageMax) {
    where.mileage = { lte: params.mileageMax };
  }

  // Lot 74 — une annonce doit avoir CHACUN des équipements cochés (facette
  // qui affine, jamais n'élargit) : une clause `some` indépendante par
  // équipement demandé, jamais un seul `some` avec une liste d'ids (qui
  // matcherait dès qu'UN SEUL équipement correspond, pas tous).
  if (params.equipmentIds && params.equipmentIds.length > 0) {
    where.AND = params.equipmentIds.map((equipmentId) => ({
      equipments: { some: { equipmentId } },
    }));
  }

  return where;
}

export function buildListingOrderBy(sort?: SortOption): Prisma.ListingOrderByWithRelationInput {
  switch (sort) {
    case "price_asc":
      return { price: "asc" };
    case "price_desc":
      return { price: "desc" };
    case "recent":
    default:
      return { createdAt: "desc" };
  }
}

export function currentPage(params: SearchParams): number {
  return Math.max(1, params.page ?? 1);
}

export function paginationOffset(params: SearchParams): number {
  return (currentPage(params) - 1) * PAGE_SIZE;
}

export function totalPages(totalCount: number): number {
  return Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
}
