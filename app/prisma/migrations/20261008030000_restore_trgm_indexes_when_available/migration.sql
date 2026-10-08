-- Lot 265 (audit 2026-10-08, constat A6) — les index trigramme de la recherche par mot (Lot 139) avaient été
-- supprimés par 20260927120000_drop_trgm_indexes parce que pg_trgm ne se charge pas sous Windows / PostgreSQL 17,
-- et rien ne les remplaçait : chaque recherche avec un mot lisait toute la table (findMany + count) en ILIKE.
--
-- Cette migration les recrée QUAND l'extension est utilisable (hébergeur Linux avec postgresql-contrib) et
-- passe sans erreur sinon (poste de développement Windows) : la recherche fonctionne dans les deux cas, avec
-- ou sans index. Vérifier après déploiement : SELECT indexname FROM pg_indexes WHERE indexname LIKE 'Listing_%trgm%';
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_trgm') THEN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS pg_trgm;
      CREATE INDEX IF NOT EXISTS "Listing_title_trgm_idx" ON "Listing" USING GIN ("title" gin_trgm_ops);
      CREATE INDEX IF NOT EXISTS "Listing_brandFreeText_trgm_idx" ON "Listing" USING GIN ("brandFreeText" gin_trgm_ops);
      CREATE INDEX IF NOT EXISTS "Listing_modelFreeText_trgm_idx" ON "Listing" USING GIN ("modelFreeText" gin_trgm_ops);
      RAISE NOTICE 'Index trigramme de recherche créés (pg_trgm).';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'pg_trgm indisponible sur ce serveur (%) : recherche par mot sans index.', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'Extension pg_trgm absente (paquet postgresql-contrib) : recherche par mot sans index.';
  END IF;
END $$;
