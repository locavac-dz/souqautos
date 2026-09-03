-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Report" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listingId" TEXT,
    "reportedUserId" TEXT,
    "authorId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "comment" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OUVERT',
    "resolutionNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    CONSTRAINT "Report_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Report_reportedUserId_fkey" FOREIGN KEY ("reportedUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Report_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Report" ("authorId", "comment", "createdAt", "id", "listingId", "reason", "resolutionNote", "resolvedAt", "status") SELECT "authorId", "comment", "createdAt", "id", "listingId", "reason", "resolutionNote", "resolvedAt", "status" FROM "Report";
DROP TABLE "Report";
ALTER TABLE "new_Report" RENAME TO "Report";
CREATE INDEX "Report_status_idx" ON "Report"("status");
CREATE UNIQUE INDEX "Report_listingId_authorId_key" ON "Report"("listingId", "authorId");
CREATE UNIQUE INDEX "Report_reportedUserId_authorId_key" ON "Report"("reportedUserId", "authorId");
CREATE TABLE "new_Review" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sellerId" TEXT,
    "professionalAccountId" TEXT,
    "authorId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Review_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Review_professionalAccountId_fkey" FOREIGN KEY ("professionalAccountId") REFERENCES "ProfessionalAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Review_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Review" ("authorId", "comment", "createdAt", "id", "rating", "sellerId") SELECT "authorId", "comment", "createdAt", "id", "rating", "sellerId" FROM "Review";
DROP TABLE "Review";
ALTER TABLE "new_Review" RENAME TO "Review";
CREATE INDEX "Review_sellerId_idx" ON "Review"("sellerId");
CREATE INDEX "Review_professionalAccountId_idx" ON "Review"("professionalAccountId");
CREATE UNIQUE INDEX "Review_sellerId_authorId_key" ON "Review"("sellerId", "authorId");
CREATE UNIQUE INDEX "Review_professionalAccountId_authorId_key" ON "Review"("professionalAccountId", "authorId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
