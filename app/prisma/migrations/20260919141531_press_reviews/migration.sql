-- CreateTable
CREATE TABLE "PressReview" (
    "id" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sourcePublishedAt" TIMESTAMP(3),
    "noteFr" TEXT NOT NULL,
    "noteAr" TEXT NOT NULL,
    "brandId" INTEGER,
    "modelId" INTEGER,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PressReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PressReview_url_key" ON "PressReview"("url");

-- CreateIndex
CREATE INDEX "PressReview_publishedAt_idx" ON "PressReview"("publishedAt");

-- CreateIndex
CREATE INDEX "PressReview_modelId_publishedAt_idx" ON "PressReview"("modelId", "publishedAt");

-- AddForeignKey
ALTER TABLE "PressReview" ADD CONSTRAINT "PressReview_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PressReview" ADD CONSTRAINT "PressReview_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE SET NULL ON UPDATE CASCADE;
