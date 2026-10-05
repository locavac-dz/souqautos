-- Lot 255 — rôle SUPER_ADMIN (PDG / fondateur)
-- PostgreSQL : les enums sont modifiés avec ALTER TYPE … ADD VALUE.
-- La valeur est ajoutée après ADMIN pour refléter la hiérarchie croissante.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN' AFTER 'ADMIN';
