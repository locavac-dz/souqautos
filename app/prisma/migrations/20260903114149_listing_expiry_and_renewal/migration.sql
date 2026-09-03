-- AlterTable
ALTER TABLE "Listing" ADD COLUMN "expiresAt" DATETIME;

-- CreateIndex
CREATE INDEX "Listing_status_expiresAt_idx" ON "Listing"("status", "expiresAt");

-- Backfill: les annonces déjà publiées avant ce lot n'ont pas d'expiresAt —
-- on le déduit de leur date de publication (30 jours, cf. LISTING_VALIDITY_DAYS)
-- pour qu'elles entrent dans le même cycle d'expiration que les nouvelles.
-- Le provider SQLite de Prisma stocke les DateTime en millisecondes Unix
-- (entier), pas en texte ISO8601 — datetime() de SQLite ne les reconnaît pas
-- et renvoie NULL silencieusement ; on ajoute donc directement l'équivalent
-- en millisecondes (30 jours = 2592000000 ms) plutôt que d'utiliser datetime().
UPDATE "Listing"
SET "expiresAt" = "publishedAt" + 2592000000
WHERE "status" = 'PUBLIEE' AND "publishedAt" IS NOT NULL;
