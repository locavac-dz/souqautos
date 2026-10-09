-- Lot 273 — messages du formulaire de contact : file de traitement, accusé de réception, référence.
-- Généré par `prisma migrate diff` puis relu (index trigramme non modélisés laissés en place).

-- CreateEnum
CREATE TYPE "ContactSubject" AS ENUM ('GENERAL', 'TECHNICAL', 'PRO', 'PARTNERSHIP', 'OTHER');

-- CreateEnum
CREATE TYPE "ContactStatus" AS ENUM ('NOUVEAU', 'PRIS_EN_CHARGE', 'REPONDU');




-- CreateTable
CREATE TABLE "ContactMessage" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "subject" "ContactSubject" NOT NULL,
    "message" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'fr',
    "routedTo" TEXT NOT NULL,
    "ackSentAt" TIMESTAMP(3),
    "status" "ContactStatus" NOT NULL DEFAULT 'NOUVEAU',
    "handledById" TEXT,
    "note" TEXT,
    "answeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContactMessage_reference_key" ON "ContactMessage"("reference");

-- CreateIndex
CREATE INDEX "ContactMessage_status_createdAt_idx" ON "ContactMessage"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "ContactMessage" ADD CONSTRAINT "ContactMessage_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

