-- Isolation RLS pour les tables du Module C.
-- Même principe que les migrations rls précédentes : cloisonnement par
-- « organisationId » via `app.org_id`, fermeture par défaut.

ALTER TABLE "reclamation" ENABLE ROW LEVEL SECURITY;
CREATE POLICY reclamation_isolation ON "reclamation"
  USING ("organisationId" = current_setting('app.org_id', true))
  WITH CHECK ("organisationId" = current_setting('app.org_id', true));

ALTER TABLE "commentaire_reclamation" ENABLE ROW LEVEL SECURITY;
CREATE POLICY commentaire_reclamation_isolation ON "commentaire_reclamation"
  USING ("organisationId" = current_setting('app.org_id', true))
  WITH CHECK ("organisationId" = current_setting('app.org_id', true));

ALTER TABLE "ordre_travail" ENABLE ROW LEVEL SECURITY;
CREATE POLICY ordre_travail_isolation ON "ordre_travail"
  USING ("organisationId" = current_setting('app.org_id', true))
  WITH CHECK ("organisationId" = current_setting('app.org_id', true));
