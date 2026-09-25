-- Lot 174 — nouvelle catégorie d'équipement : accessoires remorquage/transport
-- (attelage remorque, coffre de toit, porte-vélo, galerie de toit, porte-ski).
-- ALTER TYPE ADD VALUE est transactionnel depuis PostgreSQL 12.
ALTER TYPE "EquipmentCategory" ADD VALUE 'ACCESSOIRE';
