-- Lot 266 — journal des décisions de paiement (webhook, relecture, balayage, admin).

-- CreateEnum
CREATE TYPE "PaymentEventSource" AS ENUM ('WEBHOOK', 'REFRESH_USER', 'REFRESH_ADMIN', 'SWEEP', 'ADMIN');

-- CreateTable
CREATE TABLE "PaymentEvent" (
    "id" TEXT NOT NULL,
    "orderKind" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "source" "PaymentEventSource" NOT NULL,
    "outcome" TEXT NOT NULL,
    "providerEventId" TEXT,
    "providerStatus" TEXT,
    "amount" INTEGER,
    "currency" TEXT,
    "actorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentEvent_orderKind_orderId_createdAt_idx" ON "PaymentEvent"("orderKind", "orderId", "createdAt" DESC);
