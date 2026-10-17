-- CreateEnum
CREATE TYPE "TypeOccupant" AS ENUM ('PHYSIQUE', 'MORALE');

-- CreateEnum
CREATE TYPE "StatutContrat" AS ENUM ('BROUILLON', 'ACTIF', 'SUSPENDU', 'RESILIE');

-- AlterTable
ALTER TABLE "bien" ADD COLUMN     "archiveLe" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "occupant" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "type" "TypeOccupant" NOT NULL DEFAULT 'PHYSIQUE',
    "nom" TEXT NOT NULL,
    "prenom" TEXT,
    "telephone" TEXT,
    "email" TEXT,
    "archiveLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "occupant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contrat" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "bienId" TEXT NOT NULL,
    "occupantId" TEXT NOT NULL,
    "statut" "StatutContrat" NOT NULL DEFAULT 'BROUILLON',
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3),
    "montantLoyerCentimes" INTEGER,
    "archiveLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contrat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "occupant_organisationId_idx" ON "occupant"("organisationId");

-- CreateIndex
CREATE INDEX "contrat_organisationId_idx" ON "contrat"("organisationId");

-- CreateIndex
CREATE INDEX "contrat_bienId_idx" ON "contrat"("bienId");

-- CreateIndex
CREATE INDEX "contrat_occupantId_idx" ON "contrat"("occupantId");

-- CreateIndex
CREATE UNIQUE INDEX "contrat_organisationId_reference_key" ON "contrat"("organisationId", "reference");

-- AddForeignKey
ALTER TABLE "occupant" ADD CONSTRAINT "occupant_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrat" ADD CONSTRAINT "contrat_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrat" ADD CONSTRAINT "contrat_bienId_fkey" FOREIGN KEY ("bienId") REFERENCES "bien"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrat" ADD CONSTRAINT "contrat_occupantId_fkey" FOREIGN KEY ("occupantId") REFERENCES "occupant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
