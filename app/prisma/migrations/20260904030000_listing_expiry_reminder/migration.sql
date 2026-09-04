-- Lot 48: rappel email avant expiration d'annonce
ALTER TABLE "Listing" ADD COLUMN "expiryReminderSentAt" DATETIME;
