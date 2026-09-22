-- Lot 155 : coordonnées et catégorie d'activité sur le compte pro

CREATE TYPE "ProCategory" AS ENUM (
  'CONCESSIONNAIRE_NEUF',
  'OCCASION',
  'GARAGE',
  'IMPORTATEUR',
  'PIECES_DETACHEES'
);

ALTER TABLE "ProfessionalAccount"
  ADD COLUMN "phone"       TEXT,
  ADD COLUMN "website"     TEXT,
  ADD COLUMN "categoryPro" "ProCategory";

CREATE INDEX "ProfessionalAccount_categoryPro_idx" ON "ProfessionalAccount"("categoryPro");
