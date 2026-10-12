-- Lot 294 : table de snapshots hebdomadaires des prix du marché par modèle et année.
CREATE TABLE "MarketPriceSnapshot" (
    "id" TEXT NOT NULL,
    "brandId" INTEGER NOT NULL,
    "modelId" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "low" INTEGER NOT NULL,
    "mid" INTEGER NOT NULL,
    "high" INTEGER NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "snapshotAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketPriceSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MarketPriceSnapshot_modelId_year_snapshotAt_idx" ON "MarketPriceSnapshot"("modelId", "year", "snapshotAt");
CREATE INDEX "MarketPriceSnapshot_brandId_snapshotAt_idx" ON "MarketPriceSnapshot"("brandId", "snapshotAt");

ALTER TABLE "MarketPriceSnapshot" ADD CONSTRAINT "MarketPriceSnapshot_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketPriceSnapshot" ADD CONSTRAINT "MarketPriceSnapshot_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE CASCADE ON UPDATE CASCADE;
