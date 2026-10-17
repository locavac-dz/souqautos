-- Isolation RLS de la table des sites (cloisonnement par organisme), même
-- politique fail-closed que les autres tables métier.
ALTER TABLE "site" ENABLE ROW LEVEL SECURITY;
CREATE POLICY site_isolation ON "site"
  USING ("organisationId" = current_setting('app.org_id', true))
  WITH CHECK ("organisationId" = current_setting('app.org_id', true));
