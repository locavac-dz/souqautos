-- AlterEnum: nouvelle catégorie d'annonce pour les accessoires et équipements automobiles
ALTER TYPE "ListingCategory" ADD VALUE 'EQUIPEMENT';

-- AlterTable: fuelType, gearbox et mileage deviennent optionnels (sans sens pour une remorque ou un coffre de toit)
ALTER TABLE "Listing" ALTER COLUMN "fuelType" DROP NOT NULL;
ALTER TABLE "Listing" ALTER COLUMN "gearbox" DROP NOT NULL;
ALTER TABLE "Listing" ALTER COLUMN "mileage" DROP NOT NULL;
