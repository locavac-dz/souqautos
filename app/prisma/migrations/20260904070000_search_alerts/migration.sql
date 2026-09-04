-- Lot 56: alertes de recherche sauvegardée
CREATE TABLE "SearchAlert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "filters" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SearchAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "SearchAlert_userId_idx" ON "SearchAlert"("userId");

CREATE TABLE "SearchAlertNotification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "alertId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SearchAlertNotification_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "SearchAlert" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SearchAlertNotification_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "SearchAlertNotification_alertId_listingId_key" ON "SearchAlertNotification"("alertId", "listingId");
CREATE INDEX "SearchAlertNotification_listingId_idx" ON "SearchAlertNotification"("listingId");
