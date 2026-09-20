-- Lot 137 — deux index sur les annonces, choisis d'après des mesures (EXPLAIN ANALYZE sur 20 000 annonces).
--
-- « Plus récentes d'abord » (le tri par défaut de la recherche) lisait TOUTE la table des annonces publiées puis triait, pour
-- n'en garder que 20 : 6,7 ms sur 20 000 annonces, proportionnel au volume. Avec cet index : 0,08 ms, quel que soit le volume.
CREATE INDEX "Listing_status_createdAt_idx" ON "Listing"("status", "createdAt" DESC);

-- Les annonces publiées d'un modèle (page d'un modèle, comparables du badge « bon prix » et de la cote) : parcours complet
-- de la table avant, 3,4 ms → 0,06 ms pour un modèle rare.
CREATE INDEX "Listing_status_brandId_modelId_idx" ON "Listing"("status", "brandId", "modelId");
