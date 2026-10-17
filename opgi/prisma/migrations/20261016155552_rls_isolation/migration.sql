-- ============================================================================
--  Isolation inter‑organisme — Row-Level Security (filet de défense en profondeur)
--
--  Ces politiques s'appliquent à tout rôle SOUMIS à la RLS (c.-à-d. tout rôle
--  qui n'est ni propriétaire des tables ni superutilisateur) — en pratique le
--  rôle applicatif restreint `opgi_app` défini dans prisma/provision-roles.sql.
--  Le rôle propriétaire `opgi` (migrations, seed) n'y est PAS soumis : il peut
--  insérer les données de démonstration à travers plusieurs organismes.
--
--  L'organisme actif est lu dans le paramètre de session `app.org_id`, positionné
--  LOCALEMENT par transaction via set_config('app.org_id', <org>, true)
--  (voir src/lib/tenant/prisma.ts). `current_setting(..., true)` renvoie NULL
--  si le paramètre est absent : la politique ne laisse alors voir AUCUNE ligne
--  (fermeture par défaut — « fail closed »).
-- ============================================================================

-- La table « organisation » : un utilisateur ne voit que SA propre ligne (clé = id).
ALTER TABLE "organisation" ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation ON "organisation"
  USING ("id" = current_setting('app.org_id', true))
  WITH CHECK ("id" = current_setting('app.org_id', true));

-- Les tables métier : cloisonnées par « organisationId ».
ALTER TABLE "utilisateur" ENABLE ROW LEVEL SECURITY;
CREATE POLICY utilisateur_isolation ON "utilisateur"
  USING ("organisationId" = current_setting('app.org_id', true))
  WITH CHECK ("organisationId" = current_setting('app.org_id', true));

ALTER TABLE "bien" ENABLE ROW LEVEL SECURITY;
CREATE POLICY bien_isolation ON "bien"
  USING ("organisationId" = current_setting('app.org_id', true))
  WITH CHECK ("organisationId" = current_setting('app.org_id', true));
