-- Lot 84 : empreinte du contenu (titre+description) pour la détection de spam
ALTER TABLE "Listing" ADD COLUMN "contentHash" TEXT NOT NULL DEFAULT '';

CREATE INDEX "Listing_contentHash_idx" ON "Listing"("contentHash");
