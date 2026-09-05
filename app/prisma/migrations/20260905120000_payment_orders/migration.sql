-- Lot 66: premier mode de paiement (virement bancaire manuel)
CREATE TABLE "PaymentSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bankName" TEXT,
    "bankRib" TEXT,
    "bankAccountHolder" TEXT,
    "premiumPriceDzd" INTEGER NOT NULL DEFAULT 1000,
    "premiumPlusPriceDzd" INTEGER NOT NULL DEFAULT 2000,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "PaymentOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "formula" TEXT NOT NULL,
    "amountDzd" INTEGER NOT NULL,
    "reference" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'EN_ATTENTE',
    "reviewedById" TEXT,
    "reviewNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" DATETIME,
    CONSTRAINT "PaymentOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PaymentOrder_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PaymentOrder_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "PaymentOrder_status_idx" ON "PaymentOrder"("status");
CREATE INDEX "PaymentOrder_userId_idx" ON "PaymentOrder"("userId");
CREATE INDEX "PaymentOrder_listingId_idx" ON "PaymentOrder"("listingId");
