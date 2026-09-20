-- Lot 130 — catégories d'annonce proposées par modèle (voiture, utilitaire, poids lourd, deux-roues).
-- Les modèles existants restent des voitures ; le seed reclasse ensuite les utilitaires connus.
-- AlterTable
ALTER TABLE "Model" ADD COLUMN     "categories" "ListingCategory"[] DEFAULT ARRAY['VOITURE']::"ListingCategory"[];
