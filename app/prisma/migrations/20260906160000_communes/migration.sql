-- Lot 87 — communes (docs/ARCHITECTURE.md §5), référentiel figé sous wilaya
CREATE TABLE "Commune" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "wilayaId" INTEGER NOT NULL,
    "nomFr" TEXT NOT NULL,
    "nomAr" TEXT NOT NULL,
    CONSTRAINT "Commune_wilayaId_fkey" FOREIGN KEY ("wilayaId") REFERENCES "Wilaya" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "Commune_wilayaId_idx" ON "Commune"("wilayaId");

ALTER TABLE "Listing" ADD COLUMN "communeId" INTEGER;
CREATE INDEX "Listing_communeId_idx" ON "Listing"("communeId");
