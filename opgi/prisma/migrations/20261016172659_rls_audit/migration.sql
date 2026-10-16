-- Isolation RLS + caractère APPEND-ONLY du journal d'audit.
--
-- Cloisonnement par organisme comme les autres tables, PUIS révocation de
-- UPDATE/DELETE au rôle applicatif : le journal ne peut être ni modifié ni
-- effacé par l'application (protection contre l'altération ordinaire, brief §9).
-- Le REVOKE est gardé par l'existence du rôle (migrate peut précéder sa création).

ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_log_isolation ON "audit_log"
  USING ("organisationId" = current_setting('app.org_id', true))
  WITH CHECK ("organisationId" = current_setting('app.org_id', true));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'opgi_app') THEN
    REVOKE UPDATE, DELETE ON "audit_log" FROM opgi_app;
  END IF;
END
$$;
