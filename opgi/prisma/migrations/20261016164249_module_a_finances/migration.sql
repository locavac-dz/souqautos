-- CreateEnum
CREATE TYPE "ModePaiement" AS ENUM ('ESPECES', 'VIREMENT', 'CHEQUE', 'AUTRE');

-- CreateEnum
CREATE TYPE "TypeActionRecouvrement" AS ENUM ('RELANCE', 'MISE_EN_DEMEURE', 'ECHEANCIER', 'CONTENTIEUX', 'AUTRE');

-- CreateTable
CREATE TABLE "appel_loyer" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "contratId" TEXT NOT NULL,
    "periode" TEXT NOT NULL,
    "libelle" TEXT,
    "montantCentimes" INTEGER NOT NULL,
    "dateEcheance" TIMESTAMP(3) NOT NULL,
    "archiveLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appel_loyer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paiement" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "contratId" TEXT NOT NULL,
    "montantCentimes" INTEGER NOT NULL,
    "datePaiement" TIMESTAMP(3) NOT NULL,
    "mode" "ModePaiement" NOT NULL DEFAULT 'VIREMENT',
    "reference" TEXT,
    "note" TEXT,
    "archiveLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paiement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imputation" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "paiementId" TEXT NOT NULL,
    "appelId" TEXT NOT NULL,
    "montantCentimes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "imputation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_recouvrement" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "contratId" TEXT NOT NULL,
    "type" "TypeActionRecouvrement" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "montantConcerneCentimes" INTEGER,
    "note" TEXT,
    "pieceReference" TEXT,
    "responsableUtilisateurId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "action_recouvrement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "appel_loyer_organisationId_idx" ON "appel_loyer"("organisationId");

-- CreateIndex
CREATE INDEX "appel_loyer_contratId_idx" ON "appel_loyer"("contratId");

-- CreateIndex
CREATE UNIQUE INDEX "appel_loyer_organisationId_contratId_periode_key" ON "appel_loyer"("organisationId", "contratId", "periode");

-- CreateIndex
CREATE INDEX "paiement_organisationId_idx" ON "paiement"("organisationId");

-- CreateIndex
CREATE INDEX "paiement_contratId_idx" ON "paiement"("contratId");

-- CreateIndex
CREATE INDEX "imputation_organisationId_idx" ON "imputation"("organisationId");

-- CreateIndex
CREATE INDEX "imputation_paiementId_idx" ON "imputation"("paiementId");

-- CreateIndex
CREATE INDEX "imputation_appelId_idx" ON "imputation"("appelId");

-- CreateIndex
CREATE INDEX "action_recouvrement_organisationId_idx" ON "action_recouvrement"("organisationId");

-- CreateIndex
CREATE INDEX "action_recouvrement_contratId_idx" ON "action_recouvrement"("contratId");

-- AddForeignKey
ALTER TABLE "appel_loyer" ADD CONSTRAINT "appel_loyer_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appel_loyer" ADD CONSTRAINT "appel_loyer_contratId_fkey" FOREIGN KEY ("contratId") REFERENCES "contrat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paiement" ADD CONSTRAINT "paiement_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paiement" ADD CONSTRAINT "paiement_contratId_fkey" FOREIGN KEY ("contratId") REFERENCES "contrat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imputation" ADD CONSTRAINT "imputation_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imputation" ADD CONSTRAINT "imputation_paiementId_fkey" FOREIGN KEY ("paiementId") REFERENCES "paiement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imputation" ADD CONSTRAINT "imputation_appelId_fkey" FOREIGN KEY ("appelId") REFERENCES "appel_loyer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_recouvrement" ADD CONSTRAINT "action_recouvrement_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_recouvrement" ADD CONSTRAINT "action_recouvrement_contratId_fkey" FOREIGN KEY ("contratId") REFERENCES "contrat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
