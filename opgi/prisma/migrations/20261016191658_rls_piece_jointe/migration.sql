-- Isolation RLS de la table des pièces jointes (accès médié par organisme).
ALTER TABLE "piece_jointe" ENABLE ROW LEVEL SECURITY;
CREATE POLICY piece_jointe_isolation ON "piece_jointe"
  USING ("organisationId" = current_setting('app.org_id', true))
  WITH CHECK ("organisationId" = current_setting('app.org_id', true));
