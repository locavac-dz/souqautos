import { z } from "zod";
import { listingCategories, fuelTypes, gearboxes, conditions } from "./listing";

export const sortOptions = ["recent", "price_asc", "price_desc"] as const;
export type SortOption = (typeof sortOptions)[number];

const numeric = () =>
  z
    .string()
    .trim()
    .regex(/^\d+$/)
    .transform(Number)
    .optional()
    .catch(undefined);

// Toutes les valeurs arrivent en query string (donc en texte) — on les
// convertit/valide ici plutôt que de laisser Prisma recevoir n'importe quoi.
export const searchParamsSchema = z.object({
  q: z.string().trim().max(120).optional().catch(undefined),
  category: z.enum(listingCategories).optional().catch(undefined),
  brandId: numeric(),
  modelId: numeric(),
  wilayaId: numeric(),
  priceMin: numeric(),
  priceMax: numeric(),
  yearMin: numeric(),
  yearMax: numeric(),
  mileageMax: numeric(),
  fuelType: z.enum(fuelTypes).optional().catch(undefined),
  gearbox: z.enum(gearboxes).optional().catch(undefined),
  condition: z.enum(conditions).optional().catch(undefined),
  sort: z.enum(sortOptions).optional().catch(undefined),
  page: numeric(),
});

export type SearchParams = z.infer<typeof searchParamsSchema>;

export const PAGE_SIZE = 20;
