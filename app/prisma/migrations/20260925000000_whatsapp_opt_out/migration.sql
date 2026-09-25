-- Lot 171 — WhatsApp activé par défaut (opt-out) pour les nouveaux comptes.
-- En Algérie, WhatsApp est le canal de contact dominant ; le laisser désactivé
-- par défaut pénalisait tous les vendeurs qui n'avaient pas trouvé l'option.
-- Les comptes existants sont mis à jour : ils n'ont jamais coché la case
-- eux-mêmes (la valeur false était le défaut silencieux depuis le Lot 119).
ALTER TABLE "User" ALTER COLUMN "whatsappEnabled" SET DEFAULT true;
UPDATE "User" SET "whatsappEnabled" = true;
