-- Lot 49: historique des renouvellements d'une annonce
CREATE TABLE "ListingRenewal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listingId" TEXT NOT NULL,
    "renewedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    CONSTRAINT "ListingRenewal_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ListingRenewal_listingId_idx" ON "ListingRenewal"("listingId");
