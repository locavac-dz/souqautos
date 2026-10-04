-- Lot 243 — historique de connexion (LoginEvent)
-- Migration manuelle : le rôle souq_auto n'a pas CREATEDB (pas de shadow DB).
-- Appliquer avec :
--   npx prisma db execute --schema prisma/schema.prisma --file prisma/migrations/20261004120000_lot_243_login_events/migration.sql
--   npx prisma migrate resolve --applied 20261004120000_lot_243_login_events

CREATE TABLE "LoginEvent" (
  "id"        TEXT        NOT NULL,
  "userId"    TEXT,
  "ip"        TEXT        NOT NULL,
  "userAgent" TEXT        NOT NULL,
  "method"    TEXT        NOT NULL,
  "success"   BOOLEAN     NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LoginEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LoginEvent_userId_createdAt_idx" ON "LoginEvent" ("userId", "createdAt" DESC);
CREATE INDEX "LoginEvent_createdAt_idx"        ON "LoginEvent" ("createdAt");

ALTER TABLE "LoginEvent"
  ADD CONSTRAINT "LoginEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
