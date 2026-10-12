-- Lot 297 — Partenariat Assurance Niveau 1 : rappels d'expiration des documents.
-- Deux nouvelles valeurs dans NotificationKind + deux champs de suivi sur Listing.

-- Nouvelles valeurs de l'enum NotificationKind.
ALTER TYPE "NotificationKind" ADD VALUE 'ASSURANCE_EXPIRING';
ALTER TYPE "NotificationKind" ADD VALUE 'CT_EXPIRING';

-- Champs de suivi des rappels envoyés (même patron que expiryReminderSentAt).
ALTER TABLE "Listing" ADD COLUMN "assuranceExpiryReminderSentAt" TIMESTAMP(3);
ALTER TABLE "Listing" ADD COLUMN "ctExpiryReminderSentAt" TIMESTAMP(3);
