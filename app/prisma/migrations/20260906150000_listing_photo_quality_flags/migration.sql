-- Lot 86 : indicateurs de qualité photo (liste JSON), calculés à l'upload
ALTER TABLE "ListingPhoto" ADD COLUMN "qualityFlags" TEXT NOT NULL DEFAULT '[]';
