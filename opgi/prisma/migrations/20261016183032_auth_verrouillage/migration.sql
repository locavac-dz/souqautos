-- AlterTable
ALTER TABLE "utilisateur" ADD COLUMN     "echecsConnexion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "verrouilleJusqua" TIMESTAMP(3);
