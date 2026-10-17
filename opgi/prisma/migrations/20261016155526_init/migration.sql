-- CreateEnum
CREATE TYPE "ModuleOpgi" AS ENUM ('A', 'B', 'C');

-- CreateEnum
CREATE TYPE "RoleOpgi" AS ENUM ('ADMIN_PLATEFORME', 'ADMIN_OPGI', 'DIRECTION', 'AGENT_LOCATIF', 'AGENT_RECOUVREMENT', 'CHEF_PROJET', 'GESTIONNAIRE_MARCHES', 'RESP_RECLAMATIONS', 'TECHNICIEN', 'PRESTATAIRE', 'OCCUPANT', 'AUDITEUR');

-- CreateEnum
CREATE TYPE "TypeBien" AS ENUM ('LOGEMENT', 'LOCAL_COMMERCIAL', 'GARAGE', 'AUTRE');

-- CreateEnum
CREATE TYPE "EtatOccupation" AS ENUM ('OCCUPE', 'VACANT', 'INDISPONIBLE');

-- CreateTable
CREATE TABLE "organisation" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "modules" "ModuleOpgi"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organisation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "utilisateur" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" "RoleOpgi" NOT NULL,
    "perimetre" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "utilisateur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bien" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "TypeBien" NOT NULL,
    "etatOccupation" "EtatOccupation" NOT NULL DEFAULT 'VACANT',
    "adresse" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bien_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organisation_code_key" ON "organisation"("code");

-- CreateIndex
CREATE INDEX "utilisateur_organisationId_idx" ON "utilisateur"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "utilisateur_organisationId_email_key" ON "utilisateur"("organisationId", "email");

-- CreateIndex
CREATE INDEX "bien_organisationId_idx" ON "bien"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "bien_organisationId_code_key" ON "bien"("organisationId", "code");

-- AddForeignKey
ALTER TABLE "utilisateur" ADD CONSTRAINT "utilisateur_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bien" ADD CONSTRAINT "bien_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
