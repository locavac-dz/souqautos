-- Lot 77 : empreinte SHA-256 des photos d'annonce (signal anti-fraude,
-- docs/ARCHITECTURE.md §16 — détection de photos réutilisées entre vendeurs).
ALTER TABLE "ListingPhoto" ADD COLUMN "sha256" TEXT NOT NULL DEFAULT '';

CREATE INDEX "ListingPhoto_sha256_idx" ON "ListingPhoto"("sha256");
