-- Lot 83 : quotas/prix d'abonnement pro configurables en back-office
CREATE TABLE "ProSubscriptionSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "starterQuota" INTEGER NOT NULL DEFAULT 5,
    "businessQuota" INTEGER NOT NULL DEFAULT 20,
    "proQuota" INTEGER NOT NULL DEFAULT 60,
    "businessPriceDzd" INTEGER NOT NULL DEFAULT 3000,
    "proPriceDzd" INTEGER NOT NULL DEFAULT 6000,
    "premiumPriceDzd" INTEGER NOT NULL DEFAULT 12000,
    "updatedAt" DATETIME NOT NULL
);
