-- Lot 139 — recherche par mot : index trigramme sur le texte des annonces.
--
-- La recherche « contient » (ILIKE '%mot%') ne peut pas utiliser un index ordinaire : chaque recherche, et surtout le COMPTAGE
-- qui sert à la pagination, lisait toute la table (66 à 158 ms à 100 000 annonces, proportionnel au volume ; 408 ms pour un mot
-- qui ne correspond à rien). Un index GIN de trigrammes (triplets de lettres) le rend indexable : 0,03 à 15 ms pour un mot précis.
--
-- pg_trgm est une extension « de confiance » depuis PostgreSQL 13 : le propriétaire de la base peut la créer sans être
-- super-utilisateur. Sur PostgreSQL 12 ou moins, ou si le paquet des extensions (« postgresql-contrib ») n'est pas installé, cette
-- migration échoue : voir docs/EXPLOITATION.md. Le site fonctionne sans ces index (les requêtes sont les mêmes), seulement plus
-- lentement quand le volume grossit.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateIndex
CREATE INDEX "Listing_title_trgm_idx" ON "Listing" USING GIN ("title" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Listing_brandFreeText_trgm_idx" ON "Listing" USING GIN ("brandFreeText" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Listing_modelFreeText_trgm_idx" ON "Listing" USING GIN ("modelFreeText" gin_trgm_ops);
