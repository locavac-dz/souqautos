-- CreateEnum
CREATE TYPE "ResultatAudit" AS ENUM ('SUCCES', 'ECHEC');

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "utilisateurId" TEXT,
    "action" TEXT NOT NULL,
    "objetType" TEXT NOT NULL,
    "objetId" TEXT,
    "resultat" "ResultatAudit" NOT NULL DEFAULT 'SUCCES',
    "resume" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_log_organisationId_createdAt_idx" ON "audit_log"("organisationId", "createdAt");

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
