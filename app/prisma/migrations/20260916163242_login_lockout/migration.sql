-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Listing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sellerId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "brandId" INTEGER,
    "modelId" INTEGER,
    "generationId" INTEGER,
    "brandFreeText" TEXT,
    "modelFreeText" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "mileage" INTEGER NOT NULL,
    "fuelType" TEXT NOT NULL,
    "gearbox" TEXT NOT NULL,
    "transmission" TEXT,
    "color" TEXT,
    "doors" INTEGER,
    "seats" INTEGER,
    "powerHp" INTEGER,
    "condition" TEXT NOT NULL,
    "firstHand" BOOLEAN NOT NULL DEFAULT false,
    "accidented" BOOLEAN NOT NULL DEFAULT false,
    "wilayaId" INTEGER NOT NULL,
    "communeId" INTEGER,
    "formula" TEXT NOT NULL DEFAULT 'STANDARD',
    "status" TEXT NOT NULL DEFAULT 'BROUILLON',
    "moderationNote" TEXT,
    "views" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" DATETIME,
    "expiresAt" DATETIME,
    "expiryReminderSentAt" DATETIME,
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "contentHash" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "Listing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Listing_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Listing_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Listing_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "Generation" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Listing_wilayaId_fkey" FOREIGN KEY ("wilayaId") REFERENCES "Wilaya" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Listing_communeId_fkey" FOREIGN KEY ("communeId") REFERENCES "Commune" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Listing" ("accidented", "autoRenew", "brandFreeText", "brandId", "category", "color", "communeId", "condition", "contentHash", "createdAt", "description", "doors", "expiresAt", "expiryReminderSentAt", "firstHand", "formula", "fuelType", "gearbox", "generationId", "id", "mileage", "modelFreeText", "modelId", "moderationNote", "powerHp", "price", "publishedAt", "seats", "sellerId", "status", "title", "transmission", "views", "wilayaId", "year") SELECT "accidented", "autoRenew", "brandFreeText", "brandId", "category", "color", "communeId", "condition", "contentHash", "createdAt", "description", "doors", "expiresAt", "expiryReminderSentAt", "firstHand", "formula", "fuelType", "gearbox", "generationId", "id", "mileage", "modelFreeText", "modelId", "moderationNote", "powerHp", "price", "publishedAt", "seats", "sellerId", "status", "title", "transmission", "views", "wilayaId", "year" FROM "Listing";
DROP TABLE "Listing";
ALTER TABLE "new_Listing" RENAME TO "Listing";
CREATE INDEX "Listing_status_category_wilayaId_idx" ON "Listing"("status", "category", "wilayaId");
CREATE INDEX "Listing_sellerId_idx" ON "Listing"("sellerId");
CREATE INDEX "Listing_status_expiresAt_idx" ON "Listing"("status", "expiresAt");
CREATE INDEX "Listing_contentHash_idx" ON "Listing"("contentHash");
CREATE INDEX "Listing_communeId_idx" ON "Listing"("communeId");
CREATE INDEX "Listing_generationId_idx" ON "Listing"("generationId");
CREATE TABLE "new_PaymentSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "bankName" TEXT,
    "bankRib" TEXT,
    "bankAccountHolder" TEXT,
    "premiumPriceDzd" INTEGER NOT NULL DEFAULT 1000,
    "premiumPlusPriceDzd" INTEGER NOT NULL DEFAULT 2000,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_PaymentSettings" ("bankAccountHolder", "bankName", "bankRib", "id", "premiumPlusPriceDzd", "premiumPriceDzd", "updatedAt") SELECT "bankAccountHolder", "bankName", "bankRib", "id", "premiumPlusPriceDzd", "premiumPriceDzd", "updatedAt" FROM "PaymentSettings";
DROP TABLE "PaymentSettings";
ALTER TABLE "new_PaymentSettings" RENAME TO "PaymentSettings";
CREATE TABLE "new_ProSubscriptionSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "starterQuota" INTEGER NOT NULL DEFAULT 5,
    "businessQuota" INTEGER NOT NULL DEFAULT 20,
    "proQuota" INTEGER NOT NULL DEFAULT 60,
    "businessPriceDzd" INTEGER NOT NULL DEFAULT 3000,
    "proPriceDzd" INTEGER NOT NULL DEFAULT 6000,
    "premiumPriceDzd" INTEGER NOT NULL DEFAULT 12000,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_ProSubscriptionSettings" ("businessPriceDzd", "businessQuota", "id", "premiumPriceDzd", "proPriceDzd", "proQuota", "starterQuota", "updatedAt") SELECT "businessPriceDzd", "businessQuota", "id", "premiumPriceDzd", "proPriceDzd", "proQuota", "starterQuota", "updatedAt" FROM "ProSubscriptionSettings";
DROP TABLE "ProSubscriptionSettings";
ALTER TABLE "new_ProSubscriptionSettings" RENAME TO "ProSubscriptionSettings";
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'PARTICULIER',
    "emailVerifiedAt" DATETIME,
    "phoneVerifiedAt" DATETIME,
    "identityVerifiedAt" DATETIME,
    "locale" TEXT NOT NULL DEFAULT 'fr',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "suspendedAt" DATETIME,
    "suspensionReason" TEXT,
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" DATETIME,
    "deletedAt" DATETIME
);
INSERT INTO "new_User" ("createdAt", "deletedAt", "email", "emailVerifiedAt", "id", "identityVerifiedAt", "locale", "passwordHash", "phone", "phoneVerifiedAt", "role", "suspendedAt", "suspensionReason") SELECT "createdAt", "deletedAt", "email", "emailVerifiedAt", "id", "identityVerifiedAt", "locale", "passwordHash", "phone", "phoneVerifiedAt", "role", "suspendedAt", "suspensionReason" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
CREATE TABLE "new_Wilaya" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nomFr" TEXT NOT NULL,
    "nomAr" TEXT NOT NULL
);
INSERT INTO "new_Wilaya" ("code", "id", "nomAr", "nomFr", "slug") SELECT "code", "id", "nomAr", "nomFr", "slug" FROM "Wilaya";
DROP TABLE "Wilaya";
ALTER TABLE "new_Wilaya" RENAME TO "Wilaya";
CREATE UNIQUE INDEX "Wilaya_code_key" ON "Wilaya"("code");
CREATE UNIQUE INDEX "Wilaya_slug_key" ON "Wilaya"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
