-- Lot 264 — paiement en ligne Chargily Pay (CIB / Edahabia), à côté du virement manuel (Lot 66).

-- CreateEnum : qui encaisse (VIREMENT = rapprochement humain, CHARGILY = webhook signé / relecture).
CREATE TYPE "PaymentProvider" AS ENUM ('VIREMENT', 'CHARGILY');

-- AlterEnum : paiement en ligne échoué / annulé / expiré côté prestataire — ni confirmé ni refusé par un humain.
-- Libère la place « une seule commande EN_ATTENTE par annonce / compte pro » (index partiels du baseline).
ALTER TYPE "PaymentOrderStatus" ADD VALUE 'ANNULEE';

-- AlterTable : commandes de formule d'annonce. Les lignes existantes restent des virements.
ALTER TABLE "PaymentOrder"
  ADD COLUMN "provider" "PaymentProvider" NOT NULL DEFAULT 'VIREMENT',
  ADD COLUMN "providerCheckoutId" TEXT,
  ADD COLUMN "paidAt" TIMESTAMP(3);

-- AlterTable : commandes d'abonnement professionnel.
ALTER TABLE "ProSubscriptionOrder"
  ADD COLUMN "provider" "PaymentProvider" NOT NULL DEFAULT 'VIREMENT',
  ADD COLUMN "providerCheckoutId" TEXT,
  ADD COLUMN "paidAt" TIMESTAMP(3);

-- CreateIndex : un checkout Chargily ne peut correspondre qu'à une seule commande — c'est par cet
-- identifiant qu'un webhook retrouve la commande (jamais par une donnée recopiée par le prestataire).
CREATE UNIQUE INDEX "PaymentOrder_providerCheckoutId_key" ON "PaymentOrder"("providerCheckoutId");
CREATE UNIQUE INDEX "ProSubscriptionOrder_providerCheckoutId_key" ON "ProSubscriptionOrder"("providerCheckoutId");
