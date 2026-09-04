-- Lot 47: seuils de signalement configurables depuis le back-office
CREATE TABLE "ModerationSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "autoSuspendListingThreshold" INTEGER NOT NULL DEFAULT 3,
    "autoSuspendUserThreshold" INTEGER NOT NULL DEFAULT 3,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "ModerationSettings" ("id", "autoSuspendListingThreshold", "autoSuspendUserThreshold", "updatedAt")
VALUES ('singleton', 3, 3, CURRENT_TIMESTAMP);
