-- Lot 246 — Anti-fraude V3 : score persistant + analyse IA.
-- fraudScore : score composite 0-100 calculé à la soumission (5 signaux pondérés).
-- fraudCheckedAt : horodatage du dernier calcul (pour savoir si le score est à jour).
-- aiSuspicion : note textuelle de l'analyse Claude API, null si absente.
-- aiCheckedAt : horodatage de la dernière analyse IA.
ALTER TABLE "Listing" ADD COLUMN "fraudScore" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Listing" ADD COLUMN "fraudCheckedAt" TIMESTAMP(3);
ALTER TABLE "Listing" ADD COLUMN "aiSuspicion" TEXT;
ALTER TABLE "Listing" ADD COLUMN "aiCheckedAt" TIMESTAMP(3);
CREATE INDEX "Listing_status_fraudScore_idx" ON "Listing"("status", "fraudScore" DESC);
