import type {
  ListingCategory,
  FuelType,
  Gearbox,
  Transmission,
  ListingCondition,
} from "@prisma/client";

export type WizardData = {
  category?: ListingCategory;
  brandId?: number;
  brandName?: string; // libellé choisi, pour l'affichage en prévisualisation
  brandFreeText?: string;
  modelId?: number;
  modelName?: string;
  modelFreeText?: string;
  year?: number;
  mileage?: number;
  fuelType?: FuelType;
  gearbox?: Gearbox;
  transmission?: Transmission;
  color?: string;
  doors?: number;
  seats?: number;
  powerHp?: number;
  condition?: ListingCondition;
  firstHand?: boolean;
  accidented?: boolean;
  equipmentIds?: number[];
  price?: number;
  title?: string;
  description?: string;
  wilayaId?: number;
  wilayaName?: string;
  communeId?: number;
  communeName?: string;
  phone?: string;
};

export const WIZARD_STEPS = [
  "etape-1",
  "etape-2",
  "etape-3",
  "etape-4",
  "etape-5",
  "etape-6",
  "etape-7",
  "etape-8",
  "etape-9",
  "etape-10",
  "etape-11",
] as const;

export type WizardStepPath = (typeof WIZARD_STEPS)[number];
