-- Lot 82 : renouvellement automatique par annonce (palier Pro/Premium)
ALTER TABLE "Listing" ADD COLUMN "autoRenew" BOOLEAN NOT NULL DEFAULT false;
