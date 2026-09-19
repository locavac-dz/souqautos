import { prisma } from "@/lib/prisma";

// Lot 110 — catalogue marque > modèle > génération pour le formulaire d'essai
// (trois listes déroulantes en cascade). Même source que l'assistant de
// publication : rien de plus que le référentiel existant.
export async function getCatalogueForRoadTests() {
  return prisma.brand.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      models: {
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          generations: { orderBy: { yearStart: "asc" }, select: { id: true, name: true } },
        },
      },
    },
  });
}
