-- Lot 278 — double validation des virements au-dessus d'un seuil : réglage et première validation.
-- Généré par `prisma migrate diff` puis relu (index trigramme non modélisés laissés en place).


-- AlterTable
ALTER TABLE "PaymentOrder" ADD COLUMN     "firstApprovedAt" TIMESTAMP(3),
ADD COLUMN     "firstApprovedById" TEXT;

-- AlterTable
ALTER TABLE "PaymentSettings" ADD COLUMN     "dualApprovalThresholdDzd" INTEGER;

-- AlterTable
ALTER TABLE "ProSubscriptionOrder" ADD COLUMN     "firstApprovedAt" TIMESTAMP(3),
ADD COLUMN     "firstApprovedById" TEXT;

-- AddForeignKey
ALTER TABLE "PaymentOrder" ADD CONSTRAINT "PaymentOrder_firstApprovedById_fkey" FOREIGN KEY ("firstApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProSubscriptionOrder" ADD CONSTRAINT "ProSubscriptionOrder_firstApprovedById_fkey" FOREIGN KEY ("firstApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

