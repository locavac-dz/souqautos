-- Audit sécurité Lot 69 : course concurrente sur les demandes de paiement
-- EN_ATTENTE.

-- PaymentOrder : un seul virement EN_ATTENTE par annonce était vérifié
-- seulement en application (route upgrade-formula/route.ts) — index unique
-- filtré, même correctif que IdentityVerificationRequest (2026-09-04).
CREATE UNIQUE INDEX "PaymentOrder_pending_unique"
  ON "PaymentOrder"("listingId")
  WHERE "status" = 'EN_ATTENTE';
