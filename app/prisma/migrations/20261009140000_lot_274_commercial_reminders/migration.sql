-- Lot 274 — relances commerciales : marqueurs de relance (virement, abonnement) et notification SUBSCRIPTION_EXPIRING.
-- Généré par `prisma migrate diff` puis relu (index trigramme non modélisés laissés en place).

-- AlterEnum
ALTER TYPE "NotificationKind" ADD VALUE 'SUBSCRIPTION_EXPIRING';


-- AlterTable
ALTER TABLE "PaymentOrder" ADD COLUMN     "reminderSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ProSubscription" ADD COLUMN     "reminder15SentAt" TIMESTAMP(3),
ADD COLUMN     "reminder3SentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ProSubscriptionOrder" ADD COLUMN     "reminderSentAt" TIMESTAMP(3);

