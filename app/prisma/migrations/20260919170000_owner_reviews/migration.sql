-- CreateEnum
CREATE TYPE "OwnerReviewStatus" AS ENUM ('EN_ATTENTE', 'PUBLIE', 'REFUSE');

-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "ownerReviewId" TEXT;

-- CreateTable
CREATE TABLE "OwnerReview" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "modelId" INTEGER NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "purchaseYear" INTEGER,
    "mileageKm" INTEGER,
    "status" "OwnerReviewStatus" NOT NULL DEFAULT 'EN_ATTENTE',
    "rejectionReason" TEXT,
    "moderatedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OwnerReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OwnerReview_modelId_status_idx" ON "OwnerReview"("modelId", "status");

-- CreateIndex
CREATE INDEX "OwnerReview_status_createdAt_idx" ON "OwnerReview"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OwnerReview_userId_modelId_key" ON "OwnerReview"("userId", "modelId");

-- CreateIndex
CREATE UNIQUE INDEX "Report_ownerReviewId_authorId_key" ON "Report"("ownerReviewId", "authorId");

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_ownerReviewId_fkey" FOREIGN KEY ("ownerReviewId") REFERENCES "OwnerReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerReview" ADD CONSTRAINT "OwnerReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerReview" ADD CONSTRAINT "OwnerReview_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE CASCADE ON UPDATE CASCADE;

