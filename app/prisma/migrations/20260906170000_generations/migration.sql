-- Lot 88 : profondeur de catalogue (générations), référentiel partiel vérifié modèle par modèle
CREATE TABLE "Generation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "modelId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "yearStart" INTEGER NOT NULL,
    "yearEnd" INTEGER,
    CONSTRAINT "Generation_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "Generation_modelId_idx" ON "Generation"("modelId");
CREATE UNIQUE INDEX "Generation_modelId_name_key" ON "Generation"("modelId", "name");

ALTER TABLE "Listing" ADD COLUMN "generationId" INTEGER;
CREATE INDEX "Listing_generationId_idx" ON "Listing"("generationId");
