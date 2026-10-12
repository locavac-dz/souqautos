-- Lot 296 : vérification d'annonces renforcée — champ VIN optionnel

ALTER TABLE "Listing" ADD COLUMN "vin" TEXT;

-- Index simple pour la recherche de doublons VIN (la contrainte d'unicité partielle
-- est vérifiée au niveau applicatif plutôt que par un index partiel, car le filtre
-- sur les statuts actifs dépend de la logique métier et non du schéma).
CREATE INDEX "Listing_vin_idx" ON "Listing"("vin");
