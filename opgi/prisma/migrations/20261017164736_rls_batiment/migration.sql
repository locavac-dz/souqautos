-- Isolation RLS de la table des bâtiments (cloisonnement par organisme), même
-- politique fail-closed que les autres tables métier.
ALTER TABLE "batiment" ENABLE ROW LEVEL SECURITY;
CREATE POLICY batiment_isolation ON "batiment"
  USING ("organisationId" = current_setting('app.org_id', true))
  WITH CHECK ("organisationId" = current_setting('app.org_id', true));
