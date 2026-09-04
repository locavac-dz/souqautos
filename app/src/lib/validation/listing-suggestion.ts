import { z } from "zod";
import { listingCategories, fuelTypes, gearboxes, transmissions, conditions } from "./listing";

const currentYear = new Date().getFullYear();

// Sous-ensemble des champs déjà saisis avant l'étape 7 de l'assistant de
// publication (titre/description) — marque/modèle en libellé texte
// (l'utilisateur les a déjà choisis via catalogue ou texte libre, seul le nom
// affiché compte ici, jamais l'id).
export const listingSuggestionInputSchema = z.object({
  category: z.enum(listingCategories),
  brand: z.string().trim().min(1).max(60),
  model: z.string().trim().max(60).optional(),
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
  firstHand: z.boolean().optional(),
  accidented: z.boolean().optional(),
  price: z.number().int().positive().max(999_999_999).optional(),
});

export type ListingSuggestionInput = z.infer<typeof listingSuggestionInputSchema>;
