-- Lot 241 — Centre de notifications in-app
-- Crée l'enum NotificationKind et la table UserNotification.
-- TTL 30 jours appliqué par le sweeper nightly (notification-sweep.ts).

CREATE TYPE "NotificationKind" AS ENUM (
  'NEW_MESSAGE',
  'LISTING_APPROVED',
  'LISTING_REJECTED',
  'LISTING_SUSPENDED',
  'OFFER_RECEIVED',
  'OFFER_ACCEPTED',
  'OFFER_DECLINED',
  'OFFER_COUNTERED',
  'SEARCH_ALERT_MATCH',
  'PRO_FOLLOWER_LISTING'
);

CREATE TABLE "UserNotification" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "kind"      "NotificationKind" NOT NULL,
  "data"      JSONB NOT NULL,
  "readAt"    TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserNotification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UserNotification_userId_createdAt_idx" ON "UserNotification" ("userId", "createdAt" DESC);
CREATE INDEX "UserNotification_userId_readAt_idx"    ON "UserNotification" ("userId", "readAt");

ALTER TABLE "UserNotification"
  ADD CONSTRAINT "UserNotification_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
