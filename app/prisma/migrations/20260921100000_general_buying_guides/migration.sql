-- Lot 144 — un guide d'achat peut être GÉNÉRAL : aucun modèle du catalogue (« Acheter une voiture d'occasion »).
-- La marque et le modèle deviennent facultatifs. Les guides existants gardent les leurs (aucune ligne modifiée).

-- AlterTable
ALTER TABLE "BuyingGuide" ALTER COLUMN "brandId" DROP NOT NULL,
ALTER COLUMN "modelId" DROP NOT NULL;

-- Cohérence, garantie par la base et non seulement par le code : un guide de modèle porte toujours sa marque ; un guide
-- général n'a ni marque, ni modèle, ni génération. (Prisma ne modélise pas les contraintes CHECK : elle est ajoutée ici à la main.)
ALTER TABLE "BuyingGuide" ADD CONSTRAINT "BuyingGuide_scope_check" CHECK (
  ("modelId" IS NOT NULL AND "brandId" IS NOT NULL)
  OR ("modelId" IS NULL AND "brandId" IS NULL AND "generationId" IS NULL)
);
