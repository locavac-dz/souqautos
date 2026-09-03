-- AlterTable
ALTER TABLE "User" ADD COLUMN "identityVerifiedAt" DATETIME;

-- CreateTable
CREATE TABLE "IdentityVerificationRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "documentPath" TEXT,
    "documentMime" TEXT,
    "status" TEXT NOT NULL DEFAULT 'EN_ATTENTE',
    "reviewedById" TEXT,
    "reviewNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" DATETIME,
    CONSTRAINT "IdentityVerificationRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "IdentityVerificationRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "IdentityVerificationRequest_status_idx" ON "IdentityVerificationRequest"("status");

-- CreateIndex
CREATE INDEX "IdentityVerificationRequest_userId_idx" ON "IdentityVerificationRequest"("userId");
