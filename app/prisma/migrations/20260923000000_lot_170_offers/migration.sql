-- Lot 170 — Faire une offre de prix

CREATE TYPE "OfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'WITHDRAWN');

CREATE TABLE "Offer" (
    "id"        TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "buyerId"   TEXT NOT NULL,
    "sellerId"  TEXT NOT NULL,
    "amount"    INTEGER NOT NULL,
    "message"   VARCHAR(500),
    "status"    "OfferStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Offer_listingId_idx" ON "Offer"("listingId");
CREATE INDEX "Offer_buyerId_idx"   ON "Offer"("buyerId");
CREATE INDEX "Offer_sellerId_idx"  ON "Offer"("sellerId");

ALTER TABLE "Offer" ADD CONSTRAINT "Offer_listingId_fkey"
    FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_buyerId_fkey"
    FOREIGN KEY ("buyerId")   REFERENCES "User"("id")    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_sellerId_fkey"
    FOREIGN KEY ("sellerId")  REFERENCES "User"("id")    ON DELETE CASCADE ON UPDATE CASCADE;
