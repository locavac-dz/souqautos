-- Lot 51: suppression de compte à la demande du titulaire (anonymisation)
ALTER TABLE "User" ADD COLUMN "deletedAt" DATETIME;
