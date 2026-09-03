-- Lot 42: permissions de collaborateur plus fines (JSON) au lieu du rôle
-- binaire GESTIONNAIRE/LECTURE_SEULE. Backfill : GESTIONNAIRE -> les deux
-- permissions activées (comportement inchangé pour les collaborateurs
-- existants), LECTURE_SEULE -> aucune permission activée.
ALTER TABLE "ProCollaborator" ADD COLUMN "permissions" TEXT NOT NULL DEFAULT '{"gererAnnonces":false,"repondreAvis":false}';

UPDATE "ProCollaborator"
SET "permissions" = CASE
  WHEN "role" = 'GESTIONNAIRE' THEN '{"gererAnnonces":true,"repondreAvis":true}'
  ELSE '{"gererAnnonces":false,"repondreAvis":false}'
END;

ALTER TABLE "ProCollaborator" DROP COLUMN "role";
