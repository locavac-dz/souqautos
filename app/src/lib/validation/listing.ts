import { z } from "zod";
import { algerianPhoneRegex } from "./phone";

export const listingCategories = [
  "VOITURE",
  "UTILITAIRE",
  "POIDS_LOURD",
  "DEUX_ROUES",
  "AUTRE",
] as const;

export const fuelTypes = ["ESSENCE", "DIESEL", "GPL", "HYBRIDE", "ELECTRIQUE"] as const;
export const gearboxes = ["MANUELLE", "AUTOMATIQUE"] as const;
export const transmissions = ["QUATRE_X_DEUX", "QUATRE_X_QUATRE"] as const;
export const conditions = ["NEUF", "OCCASION"] as const;

const currentYear = new Date().getFullYear();

// Objet de base extrait séparément du .refine() de listingSchema — un schéma
// affiné par .refine() n'expose plus .omit()/.pick() en Zod 3, nécessaire pour
// dériver listingEditSchema (Lot 30) sans dupliquer chaque règle de champ.
const listingBaseSchema = z.object({
  category: z.enum(listingCategories),
  brandId: z.number().int().positive().optional(),
  brandFreeText: z.string().trim().min(2).max(60).optional(),
  modelId: z.number().int().positive().optional(),
  modelFreeText: z.string().trim().min(1).max(60).optional(),
  title: z.string().trim().min(10).max(120),
  description: z.string().trim().min(30).max(5000),
  price: z.number().int().positive().max(999_999_999),
  year: z.number().int().min(1970).max(currentYear + 1),
  mileage: z.number().int().min(0).max(2_000_000),
  fuelType: z.enum(fuelTypes),
  gearbox: z.enum(gearboxes),
  transmission: z.enum(transmissions).optional(),
  color: z.string().trim().max(40).optional(),
  doors: z.number().int().min(1).max(7).optional(),
  seats: z.number().int().min(1).max(9).optional(),
  powerHp: z.number().int().min(1).max(2000).optional(),
  condition: z.enum(conditions),
  firstHand: z.boolean().default(false),
  accidented: z.boolean().default(false),
  wilayaId: z.number().int().positive(),
  phone: z.string().trim().regex(algerianPhoneRegex).optional(),
});

// Lot 72 — équipements, ajoutés après coup (pas dans listingBaseSchema
// d'origine), uniquement à la création pour l'instant.
export const listingSchema = listingBaseSchema
  .extend({
    equipmentIds: z.array(z.number().int().positive()).max(30).default([]),
  })
  .refine((data) => Boolean(data.brandId) || Boolean(data.brandFreeText), {
    message: "Marque requise (catalogue ou texte libre)",
    path: ["brandId"],
  });

export type ListingInput = z.infer<typeof listingSchema>;

// Édition d'une annonce déjà publiée (Lot 30, étendu au Lot 35 pour couvrir
// catégorie/marque/modèle) : seuls le prix (flux dédié depuis le Lot 23) et
// le téléphone en restent exclus.
export const listingEditSchema = listingBaseSchema
  .omit({ price: true, phone: true })
  .refine((data) => Boolean(data.brandId) || Boolean(data.brandFreeText), {
    message: "Marque requise (catalogue ou texte libre)",
    path: ["brandId"],
  });

export type ListingEditInput = z.infer<typeof listingEditSchema>;
