-- CreateEnum
CREATE TYPE "ArticleKind" AS ENUM ('ARTICLE', 'ESSAI');

-- AlterTable
ALTER TABLE "BlogArticle" ADD COLUMN     "kind" "ArticleKind" NOT NULL DEFAULT 'ARTICLE';

-- CreateTable
CREATE TABLE "RoadTest" (
    "articleId" TEXT NOT NULL,
    "brandId" INTEGER,
    "modelId" INTEGER,
    "generationId" INTEGER,
    "rating" DOUBLE PRECISION NOT NULL,
    "prosFr" TEXT NOT NULL,
    "prosAr" TEXT NOT NULL,
    "consFr" TEXT NOT NULL,
    "consAr" TEXT NOT NULL,
    "verdictFr" TEXT NOT NULL,
    "verdictAr" TEXT NOT NULL,
    "testedVersion" TEXT,
    "testedAt" TIMESTAMP(3),

    CONSTRAINT "RoadTest_pkey" PRIMARY KEY ("articleId")
);

-- CreateIndex
CREATE INDEX "RoadTest_brandId_idx" ON "RoadTest"("brandId");

-- CreateIndex
CREATE INDEX "RoadTest_modelId_idx" ON "RoadTest"("modelId");

-- CreateIndex
CREATE INDEX "BlogArticle_kind_publishedAt_idx" ON "BlogArticle"("kind", "publishedAt");

-- AddForeignKey
ALTER TABLE "RoadTest" ADD CONSTRAINT "RoadTest_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "BlogArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoadTest" ADD CONSTRAINT "RoadTest_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoadTest" ADD CONSTRAINT "RoadTest_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoadTest" ADD CONSTRAINT "RoadTest_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "Generation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
