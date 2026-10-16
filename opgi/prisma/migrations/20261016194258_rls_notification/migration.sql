-- Isolation RLS de la table des notifications (cloisonnement par organisme ;
-- le filtrage par destinataire est appliqué par la couche applicative).
ALTER TABLE "notification" ENABLE ROW LEVEL SECURITY;
CREATE POLICY notification_isolation ON "notification"
  USING ("organisationId" = current_setting('app.org_id', true))
  WITH CHECK ("organisationId" = current_setting('app.org_id', true));
