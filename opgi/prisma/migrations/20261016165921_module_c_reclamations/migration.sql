-- CreateEnum
CREATE TYPE "CategorieReclamation" AS ENUM ('PLOMBERIE', 'ELECTRICITE', 'MACONNERIE', 'ASCENSEUR', 'CHAUFFAGE', 'PROPRETE', 'AUTRE');

-- CreateEnum
CREATE TYPE "UrgenceReclamation" AS ENUM ('FAIBLE', 'NORMALE', 'HAUTE', 'CRITIQUE');

-- CreateEnum
CREATE TYPE "StatutReclamation" AS ENUM ('NOUVELLE', 'QUALIFIEE', 'EN_COURS', 'RESOLUE', 'REJETEE', 'DOUBLON');

-- CreateEnum
CREATE TYPE "CanalReclamation" AS ENUM ('PORTAIL', 'GUICHET', 'TELEPHONE', 'EMAIL', 'COURRIER', 'AUTRE');

-- CreateEnum
CREATE TYPE "AffectationType" AS ENUM ('INTERNE', 'EXTERNE');

-- CreateEnum
CREATE TYPE "StatutOrdreTravail" AS ENUM ('OUVERT', 'PLANIFIE', 'EN_COURS', 'CLOTURE', 'ANNULE');

-- CreateTable
CREATE TABLE "reclamation" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "bienId" TEXT,
    "occupantId" TEXT,
    "declarantUtilisateurId" TEXT,
    "declarantNom" TEXT,
    "declarantContact" TEXT,
    "categorie" "CategorieReclamation" NOT NULL,
    "urgence" "UrgenceReclamation" NOT NULL DEFAULT 'NORMALE',
    "statut" "StatutReclamation" NOT NULL DEFAULT 'NOUVELLE',
    "canal" "CanalReclamation" NOT NULL DEFAULT 'PORTAIL',
    "description" TEXT NOT NULL,
    "localisation" TEXT,
    "doublonDeId" TEXT,
    "archiveLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reclamation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commentaire_reclamation" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "reclamationId" TEXT NOT NULL,
    "auteurUtilisateurId" TEXT,
    "texte" TEXT NOT NULL,
    "interne" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commentaire_reclamation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ordre_travail" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "reclamationId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "statut" "StatutOrdreTravail" NOT NULL DEFAULT 'OUVERT',
    "affectationType" "AffectationType",
    "technicienUtilisateurId" TEXT,
    "prestataireNom" TEXT,
    "datePlanifiee" TIMESTAMP(3),
    "coutEstimeCentimes" INTEGER,
    "coutConstateCentimes" INTEGER,
    "compteRendu" TEXT,
    "archiveLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ordre_travail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reclamation_organisationId_idx" ON "reclamation"("organisationId");

-- CreateIndex
CREATE INDEX "reclamation_bienId_idx" ON "reclamation"("bienId");

-- CreateIndex
CREATE INDEX "reclamation_declarantUtilisateurId_idx" ON "reclamation"("declarantUtilisateurId");

-- CreateIndex
CREATE UNIQUE INDEX "reclamation_organisationId_reference_key" ON "reclamation"("organisationId", "reference");

-- CreateIndex
CREATE INDEX "commentaire_reclamation_organisationId_idx" ON "commentaire_reclamation"("organisationId");

-- CreateIndex
CREATE INDEX "commentaire_reclamation_reclamationId_idx" ON "commentaire_reclamation"("reclamationId");

-- CreateIndex
CREATE INDEX "ordre_travail_organisationId_idx" ON "ordre_travail"("organisationId");

-- CreateIndex
CREATE INDEX "ordre_travail_reclamationId_idx" ON "ordre_travail"("reclamationId");

-- CreateIndex
CREATE INDEX "ordre_travail_technicienUtilisateurId_idx" ON "ordre_travail"("technicienUtilisateurId");

-- CreateIndex
CREATE UNIQUE INDEX "ordre_travail_organisationId_reference_key" ON "ordre_travail"("organisationId", "reference");

-- AddForeignKey
ALTER TABLE "reclamation" ADD CONSTRAINT "reclamation_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reclamation" ADD CONSTRAINT "reclamation_bienId_fkey" FOREIGN KEY ("bienId") REFERENCES "bien"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reclamation" ADD CONSTRAINT "reclamation_occupantId_fkey" FOREIGN KEY ("occupantId") REFERENCES "occupant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reclamation" ADD CONSTRAINT "reclamation_doublonDeId_fkey" FOREIGN KEY ("doublonDeId") REFERENCES "reclamation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commentaire_reclamation" ADD CONSTRAINT "commentaire_reclamation_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commentaire_reclamation" ADD CONSTRAINT "commentaire_reclamation_reclamationId_fkey" FOREIGN KEY ("reclamationId") REFERENCES "reclamation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordre_travail" ADD CONSTRAINT "ordre_travail_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordre_travail" ADD CONSTRAINT "ordre_travail_reclamationId_fkey" FOREIGN KEY ("reclamationId") REFERENCES "reclamation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
