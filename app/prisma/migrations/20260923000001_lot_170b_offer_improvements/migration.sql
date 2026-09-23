-- Lot 170b — Contre-offre, mise à jour offre, marquage VENDUE automatique

-- Nouveau statut pour la contre-offre du vendeur
ALTER TYPE "OfferStatus" ADD VALUE 'COUNTERED';

-- Montant de la contre-offre (null sauf quand status = COUNTERED)
ALTER TABLE "Offer" ADD COLUMN "counterAmount" INTEGER;
