-- AlterTable
ALTER TABLE "bien" ADD COLUMN     "siteId" TEXT;

-- CreateTable
CREATE TABLE "site" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "adresse" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archiveLe" TIMESTAMP(3),

    CONSTRAINT "site_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "site_organisationId_idx" ON "site"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "site_organisationId_code_key" ON "site"("organisationId", "code");

-- CreateIndex
CREATE INDEX "bien_siteId_idx" ON "bien"("siteId");

-- AddForeignKey
ALTER TABLE "bien" ADD CONSTRAINT "bien_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site" ADD CONSTRAINT "site_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
