-- Lot 299 : flag pour les brouillons générés par IA
ALTER TABLE "BlogArticle" ADD COLUMN "aiGenerated" BOOLEAN NOT NULL DEFAULT false;
