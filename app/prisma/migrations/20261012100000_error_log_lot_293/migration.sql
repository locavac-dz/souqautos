-- Lot 293 — table de journal d'erreurs (monitoring interne)
CREATE TABLE "ErrorLog" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "route" TEXT,
    "method" TEXT,
    "context" TEXT,
    "statusCode" INTEGER,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ErrorLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ErrorLog_fingerprint_createdAt_idx" ON "ErrorLog"("fingerprint", "createdAt");
CREATE INDEX "ErrorLog_kind_createdAt_idx" ON "ErrorLog"("kind", "createdAt");
CREATE INDEX "ErrorLog_createdAt_idx" ON "ErrorLog"("createdAt");
