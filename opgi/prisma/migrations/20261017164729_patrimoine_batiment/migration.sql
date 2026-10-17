-- AlterTable
ALTER TABLE "bien" ADD COLUMN     "batimentId" TEXT;

-- CreateTable
CREATE TABLE "batiment" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archiveLe" TIMESTAMP(3),

    CONSTRAINT "batiment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "batiment_organisationId_idx" ON "batiment"("organisationId");

-- CreateIndex
CREATE INDEX "batiment_siteId_idx" ON "batiment"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "batiment_organisationId_code_key" ON "batiment"("organisationId", "code");

-- CreateIndex
CREATE INDEX "bien_batimentId_idx" ON "bien"("batimentId");

-- AddForeignKey
ALTER TABLE "bien" ADD CONSTRAINT "bien_batimentId_fkey" FOREIGN KEY ("batimentId") REFERENCES "batiment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batiment" ADD CONSTRAINT "batiment_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batiment" ADD CONSTRAINT "batiment_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
