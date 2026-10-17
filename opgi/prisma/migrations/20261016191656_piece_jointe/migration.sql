-- CreateTable
CREATE TABLE "piece_jointe" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "reclamationId" TEXT NOT NULL,
    "nomFichier" TEXT NOT NULL,
    "typeMime" TEXT NOT NULL,
    "tailleOctets" INTEGER NOT NULL,
    "cleStockage" TEXT NOT NULL,
    "auteurUtilisateurId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "piece_jointe_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "piece_jointe_cleStockage_key" ON "piece_jointe"("cleStockage");

-- CreateIndex
CREATE INDEX "piece_jointe_organisationId_idx" ON "piece_jointe"("organisationId");

-- CreateIndex
CREATE INDEX "piece_jointe_reclamationId_idx" ON "piece_jointe"("reclamationId");

-- AddForeignKey
ALTER TABLE "piece_jointe" ADD CONSTRAINT "piece_jointe_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "piece_jointe" ADD CONSTRAINT "piece_jointe_reclamationId_fkey" FOREIGN KEY ("reclamationId") REFERENCES "reclamation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
