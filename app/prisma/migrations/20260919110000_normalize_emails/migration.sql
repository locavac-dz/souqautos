-- Lot 112 — une adresse email est la même adresse quelle que soit sa casse.
--
-- L'unicité de "User"."email" distingue les majuscules : « Ali@X.dz » et
-- « ali@x.dz » pouvaient devenir deux comptes. L'application met désormais
-- toutes les adresses en minuscules avant de les enregistrer ou de les chercher.

-- 1) Adresses déjà enregistrées. Cette instruction ÉCHOUE volontairement s'il
--    existe deux comptes qui ne diffèrent que par la casse : il faut alors les
--    fusionner ou en supprimer un à la main avant de migrer, jamais en silence.
UPDATE "User" SET "email" = lower("email") WHERE "email" <> lower("email");
UPDATE "EmailChangeRequest" SET "newEmail" = lower("newEmail") WHERE "newEmail" <> lower("newEmail");

-- 2) Garde-fou de la base, indépendant du code : même un chemin d'écriture qui
--    n'a pas normalisé (import, script, futur code) ne peut plus créer de doublon
--    de casse. Prisma ne sait pas modéliser un index sur expression : il est
--    ajouté ici à la main, comme les index uniques partiels du Lot 109.
CREATE UNIQUE INDEX "User_email_lower_key" ON "User" (lower("email"));
