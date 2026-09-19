-- AlterEnum
ALTER TYPE "ArticleKind" ADD VALUE 'GUIDE';

-- CreateTable
CREATE TABLE "BuyingGuide" (
    "articleId" TEXT NOT NULL,
    "brandId" INTEGER NOT NULL,
    "modelId" INTEGER NOT NULL,
    "generationId" INTEGER,
    "checklistFr" TEXT NOT NULL,
    "checklistAr" TEXT NOT NULL,
    "adviceFr" TEXT NOT NULL,
    "adviceAr" TEXT NOT NULL,

    CONSTRAINT "BuyingGuide_pkey" PRIMARY KEY ("articleId")
);

-- CreateIndex
CREATE INDEX "BuyingGuide_modelId_idx" ON "BuyingGuide"("modelId");

-- CreateIndex
CREATE INDEX "BuyingGuide_brandId_idx" ON "BuyingGuide"("brandId");

-- AddForeignKey
ALTER TABLE "BuyingGuide" ADD CONSTRAINT "BuyingGuide_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "BlogArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyingGuide" ADD CONSTRAINT "BuyingGuide_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyingGuide" ADD CONSTRAINT "BuyingGuide_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyingGuide" ADD CONSTRAINT "BuyingGuide_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "Generation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

