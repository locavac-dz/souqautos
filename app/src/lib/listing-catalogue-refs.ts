import { prisma } from "./prisma";

// Vérifications catalogue partagées par la création (`POST /api/listings`)
// et l'édition (`PATCH /api/listings/[id]`) d'une annonce — jamais un
// brandId/modelId/generationId/communeId/equipmentId fabriqué côté client
// accepté tel quel (Lots 2, 72/73, 87, 88). Les deux routes répétaient
// jusqu'ici la même suite de vérifications ; extraites ici pour ne pas
// laisser les deux copies diverger (Lot 99, audit qualité).
export type CatalogueRefsInput = {
  brandId?: number;
  modelId?: number;
  generationId?: number;
  wilayaId: number;
  communeId?: number;
  equipmentIds: number[];
};

export type CatalogueRefsError =
  | "unknown_brand"
  | "unknown_model"
  | "unknown_generation"
  | "unknown_wilaya"
  | "unknown_commune"
  | "unknown_equipment";

export type CatalogueRefsValidation = { ok: true } | { ok: false; error: CatalogueRefsError };

// Lot 110 — la partie marque/modèle/génération est aussi utilisée par les essais
// auto (qui n'ont ni wilaya, ni commune, ni équipements) : extraite ici plutôt
// que dupliquée.
export async function validateVehicleRefs(data: {
  brandId?: number;
  modelId?: number;
  generationId?: number;
}): Promise<CatalogueRefsValidation> {
  if (data.brandId) {
    const brand = await prisma.brand.findUnique({ where: { id: data.brandId } });
    if (!brand) return { ok: false, error: "unknown_brand" };
  }
  if (data.modelId) {
    const model = await prisma.model.findUnique({ where: { id: data.modelId } });
    if (!model || (data.brandId && model.brandId !== data.brandId)) {
      return { ok: false, error: "unknown_model" };
    }
  }
  if (data.generationId) {
    const generation = await prisma.generation.findUnique({ where: { id: data.generationId } });
    if (!generation || generation.modelId !== data.modelId) {
      return { ok: false, error: "unknown_generation" };
    }
  }
  return { ok: true };
}

export async function validateCatalogueRefs(data: CatalogueRefsInput): Promise<CatalogueRefsValidation> {
  const vehicle = await validateVehicleRefs(data);
  if (!vehicle.ok) return vehicle;

  const wilaya = await prisma.wilaya.findUnique({ where: { id: data.wilayaId } });
  if (!wilaya) return { ok: false, error: "unknown_wilaya" };

  if (data.communeId) {
    const commune = await prisma.commune.findUnique({ where: { id: data.communeId } });
    if (!commune || commune.wilayaId !== data.wilayaId) {
      return { ok: false, error: "unknown_commune" };
    }
  }

  if (data.equipmentIds.length > 0) {
    const matchingCount = await prisma.equipment.count({ where: { id: { in: data.equipmentIds } } });
    if (matchingCount !== new Set(data.equipmentIds).size) {
      return { ok: false, error: "unknown_equipment" };
    }
  }

  return { ok: true };
}
