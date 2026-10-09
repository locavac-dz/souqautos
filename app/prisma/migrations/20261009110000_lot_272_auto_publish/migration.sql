-- Lot 272 — modération à deux vitesses.
-- Réglages de publication automatique, marqueur sur l'annonce, et journal d'audit sans acteur humain
-- (adminId NULL = action du système). Généré par `prisma migrate diff` puis relu ; les index trigramme
-- (migration 20261008030000) ne sont pas modélisés et sont volontairement laissés en place.

-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_adminId_fkey";

-- AlterTable
ALTER TABLE "AuditLog" ALTER COLUMN "adminId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "autoPublishedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ModerationSettings" ADD COLUMN     "autoPublishEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "autoPublishMinApprovedListings" INTEGER NOT NULL DEFAULT 1;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
