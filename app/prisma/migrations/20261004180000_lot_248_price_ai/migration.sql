-- Lot 248 — Estimation de prix IA : fourchette Claude quand les comparables DB sont insuffisants.
ALTER TABLE "Listing" ADD COLUMN "priceAiLow"  INTEGER;
ALTER TABLE "Listing" ADD COLUMN "priceAiHigh" INTEGER;
ALTER TABLE "Listing" ADD COLUMN "priceAiAt"   TIMESTAMP(3);
