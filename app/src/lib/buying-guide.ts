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
// Lot 144 — un guide GÉNÉRAL n'a ni modèle, ni marque, ni génération : tout est écrit à `null` EXPLICITEMENT (jamais laissé
// indéfini), pour qu'une modification qui retire le modèle d'un guide existant le remette bien à zéro.
export function toBuyingGuideData(input: GuideInput, brandId: number | null) {
  const modelId = input.modelId ?? null;
  return {
    brandId: modelId === null ? null : brandId,
    modelId,
    generationId: modelId === null ? null : (input.generationId ?? null),
    checklistFr: splitLines(input.checklistFr).join("\n"),
    checklistAr: splitLines(input.checklistAr).join("\n"),
    adviceFr: input.adviceFr,
    adviceAr: input.adviceAr,
  };
}
