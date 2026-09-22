-- CreateEnum
CREATE TYPE "CallbackPreferredTime" AS ENUM ('MATIN', 'APRES_MIDI', 'SOIR', 'PEU_IMPORTE');

-- CreateEnum
CREATE TYPE "CallbackStatus" AS ENUM ('NOUVEAU', 'RAPPELE', 'ANNULE');

-- CreateTable
CREATE TABLE "CallbackRequest" (
    "id" TEXT NOT NULL,
    "proAccountId" TEXT NOT NULL,
    "listingId" TEXT,
    "callerName" TEXT NOT NULL,
    "callerPhone" TEXT NOT NULL,
    "preferredTime" "CallbackPreferredTime" NOT NULL DEFAULT 'PEU_IMPORTE',
    "status" "CallbackStatus" NOT NULL DEFAULT 'NOUVEAU',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallbackRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProFollow" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "proAccountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProFollow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CallbackRequest_proAccountId_createdAt_idx" ON "CallbackRequest"("proAccountId", "createdAt");

-- CreateIndex
CREATE INDEX "CallbackRequest_listingId_idx" ON "CallbackRequest"("listingId");

-- CreateIndex
CREATE INDEX "ProFollow_proAccountId_idx" ON "ProFollow"("proAccountId");

-- CreateIndex
CREATE INDEX "ProFollow_userId_idx" ON "ProFollow"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProFollow_userId_proAccountId_key" ON "ProFollow"("userId", "proAccountId");

-- AddForeignKey
ALTER TABLE "CallbackRequest" ADD CONSTRAINT "CallbackRequest_proAccountId_fkey" FOREIGN KEY ("proAccountId") REFERENCES "ProfessionalAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallbackRequest" ADD CONSTRAINT "CallbackRequest_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProFollow" ADD CONSTRAINT "ProFollow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProFollow" ADD CONSTRAINT "ProFollow_proAccountId_fkey" FOREIGN KEY ("proAccountId") REFERENCES "ProfessionalAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
