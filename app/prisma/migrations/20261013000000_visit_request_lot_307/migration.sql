-- Lot 307 — rendez-vous visite / essai

-- Enum pour le statut des demandes de visite
CREATE TYPE "VisitRequestStatus" AS ENUM ('EN_ATTENTE', 'CONFIRMEE', 'DECLINEE', 'ANNULEE', 'TERMINEE');

-- Nouvelles valeurs NotificationKind
ALTER TYPE "NotificationKind" ADD VALUE 'VISIT_REQUESTED';
ALTER TYPE "NotificationKind" ADD VALUE 'VISIT_CONFIRMED';
ALTER TYPE "NotificationKind" ADD VALUE 'VISIT_DECLINED';

-- Table des demandes de visite
CREATE TABLE "VisitRequest" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "proposedAt" TIMESTAMP(3) NOT NULL,
    "message" VARCHAR(500),
    "sellerNote" VARCHAR(500),
    "status" "VisitRequestStatus" NOT NULL DEFAULT 'EN_ATTENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisitRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VisitRequest_sellerId_status_idx" ON "VisitRequest"("sellerId", "status");
CREATE INDEX "VisitRequest_buyerId_status_idx" ON "VisitRequest"("buyerId", "status");
CREATE INDEX "VisitRequest_listingId_idx" ON "VisitRequest"("listingId");

ALTER TABLE "VisitRequest" ADD CONSTRAINT "VisitRequest_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VisitRequest" ADD CONSTRAINT "VisitRequest_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VisitRequest" ADD CONSTRAINT "VisitRequest_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
