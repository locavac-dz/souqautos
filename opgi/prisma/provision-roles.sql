-- ============================================================================
--  Provisionnement du rôle applicatif restreint `opgi_app`.
--
--  À exécuter par un SUPERUTILISATEUR (ou le propriétaire du cluster), UNE fois
--  par base, APRÈS `prisma migrate deploy` (les tables doivent exister pour
--  recevoir les GRANT) :
--      psql -d <base> -f prisma/provision-roles.sql
--
--  Pourquoi un rôle séparé : la Row-Level Security NE s'applique PAS au
--  propriétaire des tables (`opgi`). L'application doit donc se connecter avec
--  un rôle distinct, NON propriétaire et SANS attribut BYPASSRLS, pour être
--  réellement soumise aux politiques d'isolation. Changer le mot de passe en
--  production.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'opgi_app') THEN
    CREATE ROLE opgi_app LOGIN PASSWORD 'opgi_app_dev';
  END IF;
END
$$;

-- Jamais de contournement de la RLS pour ce rôle.
ALTER ROLE opgi_app NOBYPASSRLS;

GRANT USAGE ON SCHEMA public TO opgi_app;

-- Droits CRUD sur les tables existantes…
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO opgi_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO opgi_app;

-- …et sur les tables créées par les futures migrations (le propriétaire `opgi`
-- crée les objets ; ces droits par défaut évitent de rejouer le script).
ALTER DEFAULT PRIVILEGES FOR ROLE opgi IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO opgi_app;
ALTER DEFAULT PRIVILEGES FOR ROLE opgi IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO opgi_app;
