-- Lot 75 — page SEO /wilaya/{slug}. Ajout d'un slug unique par wilaya,
-- backfillé via slugify(nomFr) (même fonction que Brand/Model/Equipment) —
-- calcul Unicode fait côté Node (script d'application de cette migration),
-- jamais en SQL brut (cf. leçon "ne jamais réécrire de l'UTF-8 en dehors de
-- Node/Python", cette migration modifie seulement le schéma).
ALTER TABLE "Wilaya" ADD COLUMN "slug" TEXT NOT NULL DEFAULT '';

-- Le backfill réel (UPDATE par wilaya avec le slug calculé) est exécuté par
-- le script d'application, pas ici — voir le commentaire de tête.

CREATE UNIQUE INDEX "Wilaya_slug_key" ON "Wilaya"("slug");
