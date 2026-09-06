-- Lot 79 : abonnements professionnels (paliers Starter/Business/Pro/Premium)
CREATE TABLE "ProSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "professionalAccountId" TEXT NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'STARTER',
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProSubscription_professionalAccountId_fkey" FOREIGN KEY ("professionalAccountId") REFERENCES "ProfessionalAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ProSubscription_professionalAccountId_key" ON "ProSubscription"("professionalAccountId");

CREATE TABLE "ProSubscriptionOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "professionalAccountId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "amountDzd" INTEGER NOT NULL,
    "reference" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'EN_ATTENTE',
    "reviewedById" TEXT,
    "reviewNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" DATETIME,
    CONSTRAINT "ProSubscriptionOrder_professionalAccountId_fkey" FOREIGN KEY ("professionalAccountId") REFERENCES "ProfessionalAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProSubscriptionOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProSubscriptionOrder_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "ProSubscriptionOrder_status_idx" ON "ProSubscriptionOrder"("status");
CREATE INDEX "ProSubscriptionOrder_professionalAccountId_idx" ON "ProSubscriptionOrder"("professionalAccountId");

-- Même piège TOCTOU que PaymentOrder (Lot 69) — corrigé dès ce lot plutôt que
-- laissé pour un futur audit : un seul virement EN_ATTENTE par compte pro.
CREATE UNIQUE INDEX "ProSubscriptionOrder_pending_unique"
  ON "ProSubscriptionOrder"("professionalAccountId")
  WHERE "status" = 'EN_ATTENTE';
