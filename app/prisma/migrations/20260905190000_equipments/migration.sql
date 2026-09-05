-- Lot 72 — équipements du véhicule, comble l'écart documenté depuis le
-- Lot 4/45 (docs/ARCHITECTURE.md §14 : la comparabilité pour le badge
-- « Bon Prix » doit tenir compte des équipements, pas seulement année/km/wilaya).

CREATE TABLE "Equipment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "slug" TEXT NOT NULL,
    "nameFr" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "category" TEXT NOT NULL
);
CREATE UNIQUE INDEX "Equipment_slug_key" ON "Equipment"("slug");

CREATE TABLE "ListingEquipment" (
    "listingId" TEXT NOT NULL,
    "equipmentId" INTEGER NOT NULL,
    CONSTRAINT "ListingEquipment_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ListingEquipment_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    PRIMARY KEY ("listingId", "equipmentId")
);
CREATE INDEX "ListingEquipment_equipmentId_idx" ON "ListingEquipment"("equipmentId");
