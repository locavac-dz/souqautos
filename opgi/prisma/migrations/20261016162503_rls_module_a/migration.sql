-- Isolation RLS pour les nouvelles tables du Module A (occupant, contrat).
-- Même principe que 20261016155552_rls_isolation : cloisonnement par
-- « organisationId » via le paramètre de session `app.org_id`, fermeture par
-- défaut (current_setting(..., true) = NULL → aucune ligne visible).

ALTER TABLE "occupant" ENABLE ROW LEVEL SECURITY;
CREATE POLICY occupant_isolation ON "occupant"
  USING ("organisationId" = current_setting('app.org_id', true))
  WITH CHECK ("organisationId" = current_setting('app.org_id', true));

ALTER TABLE "contrat" ENABLE ROW LEVEL SECURITY;
CREATE POLICY contrat_isolation ON "contrat"
  USING ("organisationId" = current_setting('app.org_id', true))
  WITH CHECK ("organisationId" = current_setting('app.org_id', true));
