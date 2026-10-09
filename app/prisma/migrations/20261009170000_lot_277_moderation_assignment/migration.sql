-- Lot 277 — affectation dans les files de modération (annonces, signalements) : « pris en charge par X ».
-- Généré par `prisma migrate diff` puis relu (index trigramme non modélisés laissés en place).


-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "assignedAt" TIMESTAMP(3),
ADD COLUMN     "assignedToId" TEXT;

-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "assignedAt" TIMESTAMP(3),
ADD COLUMN     "assignedToId" TEXT;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

