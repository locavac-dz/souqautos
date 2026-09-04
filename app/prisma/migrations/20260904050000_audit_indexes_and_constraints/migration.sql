-- Audit complet (2026-09-04) : index manquants + course concurrente sur les
-- dossiers de vérification d'identité EN_ATTENTE.

-- Message : comptage des messages non lus (badge header + boîte de réception),
-- filtré sur conversationId+readAt et senderId+readAt à chaque chargement de page.
CREATE INDEX "Message_conversationId_readAt_idx" ON "Message"("conversationId", "readAt");
CREATE INDEX "Message_senderId_readAt_idx" ON "Message"("senderId", "readAt");

-- IdentityVerificationRequest : un seul dossier EN_ATTENTE par utilisateur
-- était vérifié seulement en application (TOCTOU sur double-clic/retry
-- réseau) — index unique filtré, SQLite supporte les index partiels.
CREATE UNIQUE INDEX "IdentityVerificationRequest_pending_unique"
  ON "IdentityVerificationRequest"("userId")
  WHERE "status" = 'EN_ATTENTE';
