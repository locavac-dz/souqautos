-- CreateEnum
CREATE TYPE "StatutProjet" AS ENUM ('EN_PREPARATION', 'EN_COURS', 'SUSPENDU', 'CLOTURE');

-- CreateEnum
CREATE TYPE "StatutMarche" AS ENUM ('EN_PREPARATION', 'NOTIFIE', 'EN_COURS', 'RECEPTIONNE', 'RESILIE', 'CLOTURE');

-- CreateEnum
CREATE TYPE "StatutSituation" AS ENUM ('DEPOSEE', 'VERIFIEE', 'VALIDEE', 'REJETEE');

-- CreateEnum
CREATE TYPE "TypeReception" AS ENUM ('PROVISOIRE', 'DEFINITIVE');

-- CreateTable
CREATE TABLE "projet" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "intitule" TEXT NOT NULL,
    "programme" TEXT,
    "sourceFinancement" TEXT,
    "statut" "StatutProjet" NOT NULL DEFAULT 'EN_PREPARATION',
    "montantInitialCentimes" INTEGER,
    "dateDebut" TIMESTAMP(3),
    "dateFinPrevue" TIMESTAMP(3),
    "archiveLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entreprise" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "raisonSociale" TEXT NOT NULL,
    "nif" TEXT,
    "rc" TEXT,
    "contact" TEXT,
    "archiveLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entreprise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marche" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "projetId" TEXT NOT NULL,
    "entrepriseId" TEXT NOT NULL,
    "objet" TEXT NOT NULL,
    "montantCentimes" INTEGER NOT NULL,
    "dateNotification" TIMESTAMP(3),
    "delaiJours" INTEGER,
    "statut" "StatutMarche" NOT NULL DEFAULT 'EN_PREPARATION',
    "archiveLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marche_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "situation_travaux" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "marcheId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "periode" TEXT,
    "montantTravauxCentimes" INTEGER NOT NULL,
    "avancementPhysiquePct" INTEGER,
    "statut" "StatutSituation" NOT NULL DEFAULT 'DEPOSEE',
    "observations" TEXT,
    "dateDepot" TIMESTAMP(3) NOT NULL,
    "dateDecision" TIMESTAMP(3),
    "decideurUtilisateurId" TEXT,
    "archiveLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "situation_travaux_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reception" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "marcheId" TEXT NOT NULL,
    "type" "TypeReception" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "avecReserves" BOOLEAN NOT NULL DEFAULT false,
    "observations" TEXT,
    "pvReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reception_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "projet_organisationId_idx" ON "projet"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "projet_organisationId_code_key" ON "projet"("organisationId", "code");

-- CreateIndex
CREATE INDEX "entreprise_organisationId_idx" ON "entreprise"("organisationId");

-- CreateIndex
CREATE INDEX "marche_organisationId_idx" ON "marche"("organisationId");

-- CreateIndex
CREATE INDEX "marche_projetId_idx" ON "marche"("projetId");

-- CreateIndex
CREATE INDEX "marche_entrepriseId_idx" ON "marche"("entrepriseId");

-- CreateIndex
CREATE UNIQUE INDEX "marche_organisationId_reference_key" ON "marche"("organisationId", "reference");

-- CreateIndex
CREATE INDEX "situation_travaux_organisationId_idx" ON "situation_travaux"("organisationId");

-- CreateIndex
CREATE INDEX "situation_travaux_marcheId_idx" ON "situation_travaux"("marcheId");

-- CreateIndex
CREATE UNIQUE INDEX "situation_travaux_marcheId_numero_key" ON "situation_travaux"("marcheId", "numero");

-- CreateIndex
CREATE INDEX "reception_organisationId_idx" ON "reception"("organisationId");

-- CreateIndex
CREATE INDEX "reception_marcheId_idx" ON "reception"("marcheId");

-- AddForeignKey
ALTER TABLE "projet" ADD CONSTRAINT "projet_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entreprise" ADD CONSTRAINT "entreprise_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marche" ADD CONSTRAINT "marche_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marche" ADD CONSTRAINT "marche_projetId_fkey" FOREIGN KEY ("projetId") REFERENCES "projet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marche" ADD CONSTRAINT "marche_entrepriseId_fkey" FOREIGN KEY ("entrepriseId") REFERENCES "entreprise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "situation_travaux" ADD CONSTRAINT "situation_travaux_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "situation_travaux" ADD CONSTRAINT "situation_travaux_marcheId_fkey" FOREIGN KEY ("marcheId") REFERENCES "marche"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reception" ADD CONSTRAINT "reception_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reception" ADD CONSTRAINT "reception_marcheId_fkey" FOREIGN KEY ("marcheId") REFERENCES "marche"("id") ON DELETE CASCADE ON UPDATE CASCADE;
