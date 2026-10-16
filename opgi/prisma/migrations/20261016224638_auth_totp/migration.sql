-- AlterTable
ALTER TABLE "utilisateur" ADD COLUMN     "totpActiveLe" TIMESTAMP(3),
ADD COLUMN     "totpSecret" TEXT;
