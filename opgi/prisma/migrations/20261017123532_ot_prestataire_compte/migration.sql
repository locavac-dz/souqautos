-- AlterTable
ALTER TABLE "ordre_travail" ADD COLUMN     "prestataireUtilisateurId" TEXT;

-- CreateIndex
CREATE INDEX "ordre_travail_prestataireUtilisateurId_idx" ON "ordre_travail"("prestataireUtilisateurId");
