-- Isolation RLS pour les tables financières du Module A.
-- Même principe que les migrations rls précédentes : cloisonnement par
-- « organisationId » via `app.org_id`, fermeture par défaut.

ALTER TABLE "appel_loyer" ENABLE ROW LEVEL SECURITY;
CREATE POLICY appel_loyer_isolation ON "appel_loyer"
  USING ("organisationId" = current_setting('app.org_id', true))
  WITH CHECK ("organisationId" = current_setting('app.org_id', true));

ALTER TABLE "paiement" ENABLE ROW LEVEL SECURITY;
CREATE POLICY paiement_isolation ON "paiement"
  USING ("organisationId" = current_setting('app.org_id', true))
  WITH CHECK ("organisationId" = current_setting('app.org_id', true));

ALTER TABLE "imputation" ENABLE ROW LEVEL SECURITY;
CREATE POLICY imputation_isolation ON "imputation"
  USING ("organisationId" = current_setting('app.org_id', true))
  WITH CHECK ("organisationId" = current_setting('app.org_id', true));

ALTER TABLE "action_recouvrement" ENABLE ROW LEVEL SECURITY;
CREATE POLICY action_recouvrement_isolation ON "action_recouvrement"
  USING ("organisationId" = current_setting('app.org_id', true))
  WITH CHECK ("organisationId" = current_setting('app.org_id', true));
