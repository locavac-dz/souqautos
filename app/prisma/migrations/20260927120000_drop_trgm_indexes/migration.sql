-- pg_trgm.dll échoue à se charger sous Windows PostgreSQL 17 (erreur 58P01 / code Windows 4551).
-- Les index GIN trigrammes sont supprimés : les requêtes ILIKE fonctionnent en séquentiel,
-- légèrement plus lentes à très gros volume mais sans crash.
DROP INDEX IF EXISTS "Listing_title_trgm_idx";
DROP INDEX IF EXISTS "Listing_brandFreeText_trgm_idx";
DROP INDEX IF EXISTS "Listing_modelFreeText_trgm_idx";
