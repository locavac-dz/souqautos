import { splitLines } from "@/lib/road-test";
import type { RoadTestInput } from "@/lib/validation/blog";

// Lot 110 — conversion d'une fiche d'essai validée vers les colonnes de
// `RoadTest`. Les listes sont normalisées (lignes vides retirées, espaces
// supprimés) pour que l'affichage ne dépende pas de la façon dont la
// rédaction a saisi les retours à la ligne.
export function toRoadTestData(input: RoadTestInput, brandIdFromModel?: number) {
  return {
    brandId: input.brandId ?? brandIdFromModel ?? null,
    modelId: input.modelId ?? null,
    generationId: input.generationId ?? null,
    rating: input.rating,
    prosFr: splitLines(input.prosFr).join("\n"),
    prosAr: splitLines(input.prosAr).join("\n"),
    consFr: splitLines(input.consFr).join("\n"),
    consAr: splitLines(input.consAr).join("\n"),
    verdictFr: input.verdictFr,
    verdictAr: input.verdictAr,
    testedVersion: input.testedVersion || null,
    testedAt: input.testedAt ? new Date(`${input.testedAt}T00:00:00Z`) : null,
  };
}
