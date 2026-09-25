-- Lot 178 — carrosserie et prix négociable
CREATE TYPE "BodyType" AS ENUM ('BERLINE', 'SUV', 'BREAK', 'CITADINE', 'COUPE', 'CABRIOLET', 'MONOSPACE', 'PICKUP', 'FOURGON');
ALTER TABLE "Listing" ADD COLUMN "bodyType" "BodyType";
ALTER TABLE "Listing" ADD COLUMN "negotiable" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "Listing_status_publishedAt_idx" ON "Listing"("status", "publishedAt" DESC NULLS LAST);
