-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable: ajouter la colonne avec APPROVED comme défaut de colonne pour que les
-- lignes existantes héritent APPROVED, puis changer le défaut à PENDING pour les
-- nouvelles insertions (les avis existants étaient déjà publiés sans modération).
ALTER TABLE "Review" ADD COLUMN "status" "ReviewStatus" NOT NULL DEFAULT 'APPROVED';
ALTER TABLE "Review" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "Review_status_idx" ON "Review"("status");
