-- Isolation RLS pour les tables du Module B.
-- Même principe que les migrations rls précédentes : cloisonnement par
-- « organisationId » via `app.org_id`, fermeture par défaut.

ALTER TABLE "projet" ENABLE ROW LEVEL SECURITY;
CREATE POLICY projet_isolation ON "projet"
  USING ("organisationId" = current_setting('app.org_id', true))
  WITH CHECK ("organisationId" = current_setting('app.org_id', true));

ALTER TABLE "entreprise" ENABLE ROW LEVEL SECURITY;
CREATE POLICY entreprise_isolation ON "entreprise"
  USING ("organisationId" = current_setting('app.org_id', true))
  WITH CHECK ("organisationId" = current_setting('app.org_id', true));

ALTER TABLE "marche" ENABLE ROW LEVEL SECURITY;
CREATE POLICY marche_isolation ON "marche"
  USING ("organisationId" = current_setting('app.org_id', true))
  WITH CHECK ("organisationId" = current_setting('app.org_id', true));

ALTER TABLE "situation_travaux" ENABLE ROW LEVEL SECURITY;
CREATE POLICY situation_travaux_isolation ON "situation_travaux"
  USING ("organisationId" = current_setting('app.org_id', true))
  WITH CHECK ("organisationId" = current_setting('app.org_id', true));

ALTER TABLE "reception" ENABLE ROW LEVEL SECURITY;
CREATE POLICY reception_isolation ON "reception"
  USING ("organisationId" = current_setting('app.org_id', true))
  WITH CHECK ("organisationId" = current_setting('app.org_id', true));
