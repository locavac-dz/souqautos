import type { Prisma } from "@prisma/client";
import { PAGE_SIZE, type SearchParams, type SortOption } from "./validation/search";

export function buildListingWhere(params: SearchParams): Prisma.ListingWhereInput {
  const where: Prisma.ListingWhereInput = { status: "PUBLIEE" };

  if (params.q) {
    const q = params.q;
    where.OR = [
      { title: { contains: q } },
      { brandFreeText: { contains: q } },
      { modelFreeText: { contains: q } },
      { brand: { name: { contains: q } } },
      { model: { name: { contains: q } } },
      { wilaya: { nomFr: { contains: q } } },
      { wilaya: { nomAr: { contains: q } } },
    ];
  }

  if (params.category) where.category = params.category;
  if (params.brandId) where.brandId = params.brandId;
  if (params.modelId) where.modelId = params.modelId;
  if (params.wilayaId) where.wilayaId = params.wilayaId;
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
