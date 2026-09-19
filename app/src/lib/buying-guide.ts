import { splitLines } from "@/lib/road-test";
import type { GuideInput } from "@/lib/validation/blog";

// Lot 126 — helpers purs des guides d'achat par modèle.

// « À vérifier avant d'acheter » : une ligne par point, un peu plus long que les points forts d'un
// essai (8 au plus) car un guide passe en revue plus de choses.
export const MAX_CHECKLIST_ITEMS = 12;
export const MAX_CHECKLIST_ITEM_LENGTH = 200;

export function isValidChecklist(text: string): boolean {
  const items = splitLines(text);
  return items.length >= 1 && items.length <= MAX_CHECKLIST_ITEMS && items.every((item) => item.length <= MAX_CHECKLIST_ITEM_LENGTH);
}

// Conversion d'une fiche de guide validée vers les colonnes de `BuyingGuide`. La liste est normalisée
// (lignes vides et espaces retirés) pour que l'affichage ne dépende pas de la façon dont la rédaction a
// saisi les retours à la ligne. La marque n'est jamais lue du navigateur : elle se déduit du modèle.
export function toBuyingGuideData(input: GuideInput, brandId: number) {
  return {
    brandId,
    modelId: input.modelId,
    generationId: input.generationId ?? null,
    checklistFr: splitLines(input.checklistFr).join("\n"),
    checklistAr: splitLines(input.checklistAr).join("\n"),
    adviceFr: input.adviceFr,
    adviceAr: input.adviceAr,
  };
}
