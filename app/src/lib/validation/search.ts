import { z } from "zod";
import { listingCategories, fuelTypes, gearboxes, conditions } from "./listing";
import { PRO_CATEGORIES } from "./pro-account";
import { INT4_MAX } from "./int-bounds";

export const sortOptions = ["recent", "price_asc", "price_desc"] as const;
export type SortOption = (typeof sortOptions)[number];

export const numeric = () =>
  z
    .string()
    .trim()
    .regex(/^\d+$/)
    .transform(Number)
    .refine((n) => n <= INT4_MAX)
    .optional()
    .catch(undefined);

// Lot 74 — un seul paramètre `equipmentIds=1,2,3` (liste séparée par des
// virgules) plutôt que des paramètres répétés : `recherche/page.tsx` aplatit
// déjà tous les query params sur leur première valeur (`Array.isArray(value)
// ? value[0] : value`), un `equipmentId=1&equipmentId=2` répété perdrait
// silencieusement toutes les valeurs sauf la première.
const equipmentIdsParam = z
  .string()
  .trim()
  .transform((value) => {
    const ids = Array.from(
      new Set(
        value
          .split(",")
          .map(Number)
          .filter((n) => Number.isInteger(n) && n > 0 && n <= INT4_MAX)
      )
    );
    return ids.length > 0 ? ids : undefined;
  })
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
  communeId: numeric(),
  priceMin: numeric(),
  priceMax: numeric(),
  yearMin: numeric(),
  yearMax: numeric(),
  mileageMax: numeric(),
  fuelType: z.enum(fuelTypes).optional().catch(undefined),
  gearbox: z.enum(gearboxes).optional().catch(undefined),
  condition: z.enum(conditions).optional().catch(undefined),
  equipmentIds: equipmentIdsParam,
  sort: z.enum(sortOptions).optional().catch(undefined),
  page: numeric(),
  sellerType: z.enum(["pro", "particulier"]).optional().catch(undefined),
  categoryPro: z.enum(PRO_CATEGORIES).optional().catch(undefined),
});

export type SearchParams = z.infer<typeof searchParamsSchema>;

export const PAGE_SIZE = 20;
