-- CreateEnum
CREATE TYPE "ProspectStatus" AS ENUM ('NOUVEAU', 'A_RAPPELER', 'EN_NEGOCIATION', 'GAGNE', 'PERDU');

-- CreateTable
CREATE TABLE "ProspectFollowUp" (
    "conversationId" TEXT NOT NULL,
    "status" "ProspectStatus" NOT NULL DEFAULT 'NOUVEAU',
    "note" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "ProspectFollowUp_pkey" PRIMARY KEY ("conversationId")
);

-- AddForeignKey
ALTER TABLE "ProspectFollowUp" ADD CONSTRAINT "ProspectFollowUp_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProspectFollowUp" ADD CONSTRAINT "ProspectFollowUp_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

