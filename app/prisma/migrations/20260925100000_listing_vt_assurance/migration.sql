-- Lot 173 — visite technique et assurance : dates d'expiration optionnelles
-- sur les annonces. Informations très demandées par les acheteurs algériens
-- pour évaluer rapidement l'état administratif du véhicule avant toute visite.
ALTER TABLE "Listing" ADD COLUMN "controltechniqueExpiry" TIMESTAMP(3);
ALTER TABLE "Listing" ADD COLUMN "assuranceExpiry" TIMESTAMP(3);
