import { z } from "zod";
import { algerianPhoneRegex } from "./phone";
import { INT4_MAX } from "./int-bounds";

export const listingCategories = [
  "VOITURE",
  "UTILITAIRE",
  "POIDS_LOURD",
  "DEUX_ROUES",
  "AUTRE",
  "EQUIPEMENT",
] as const;

export const fuelTypes = ["ESSENCE", "DIESEL", "GPL", "HYBRIDE", "ELECTRIQUE"] as const;
export const gearboxes = ["MANUELLE", "AUTOMATIQUE"] as const;
export const transmissions = ["QUATRE_X_DEUX", "QUATRE_X_QUATRE"] as const;
export const conditions = ["NEUF", "OCCASION"] as const;
export const bodyTypes = ["BERLINE", "SUV", "BREAK", "CITADINE", "COUPE", "CABRIOLET", "MONOSPACE", "PICKUP", "FOURGON"] as const;

const currentYear = new Date().getFullYear();

// Objet de base extrait séparément du .refine() de listingSchema — un schéma
// affiné par .refine() n'expose plus .omit()/.pick() en Zod 3, nécessaire pour
// dériver listingEditSchema (Lot 30) sans dupliquer chaque règle de champ.
const listingBaseSchema = z.object({
  category: z.enum(listingCategories),
  brandId: z.number().int().positive().max(INT4_MAX).optional(),
  brandFreeText: z.string().trim().min(2).max(60).optional(),
  modelId: z.number().int().positive().max(INT4_MAX).optional(),
  modelFreeText: z.string().trim().min(1).max(60).optional(),
  generationId: z.number().int().positive().max(INT4_MAX).optional(),
  title: z.string().trim().min(10).max(120),
  description: z.string().trim().min(30).max(5000),
  price: z.number().int().positive().max(999_999_999),
  year: z.number().int().min(1970).max(currentYear + 1),
  mileage: z.number().int().min(0).max(2_000_000).optional(),
  fuelType: z.enum(fuelTypes).optional(),
  gearbox: z.enum(gearboxes).optional(),
  transmission: z.enum(transmissions).optional(),
  color: z.string().trim().max(40).optional(),
  doors: z.number().int().min(1).max(7).optional(),
  seats: z.number().int().min(1).max(9).optional(),
  powerHp: z.number().int().min(1).max(2000).optional(),
  fiscalPower: z.number().int().min(1).max(99).optional(),
  bodyType: z.enum(bodyTypes).optional(),
  negotiable: z.boolean().default(false),
  condition: z.enum(conditions),
  firstHand: z.boolean().default(false),
  accidented: z.boolean().default(false),
  controltechniqueExpiry: z.coerce.date().optional(),
  assuranceExpiry: z.coerce.date().optional(),
  wilayaId: z.number().int().positive().max(INT4_MAX),
  communeId: z.number().int().positive().max(INT4_MAX).optional(),
  phone: z.string().trim().regex(algerianPhoneRegex).optional(),
});

// Lot 72/73 — équipements, ajoutés après coup (pas dans listingBaseSchema
// d'origine) sur la création ET l'édition : extrait en constante partagée pour
// ne jamais laisser diverger les deux bornes (max 30) entre les deux schémas.
const equipmentIdsField = z.array(z.number().int().positive().max(INT4_MAX)).max(30).default([]);

export const listingSchema = listingBaseSchema
  .extend({ equipmentIds: equipmentIdsField })
  .superRefine((data, ctx) => {
    if (data.category !== "EQUIPEMENT") {
      if (!data.fuelType) ctx.addIssue({ code: "custom", path: ["fuelType"], message: "Carburant requis" });
      if (!data.gearbox) ctx.addIssue({ code: "custom", path: ["gearbox"], message: "Boîte de vitesses requise" });
      if (data.mileage === undefined) ctx.addIssue({ code: "custom", path: ["mileage"], message: "Kilométrage requis" });
    }
  })
  .refine((data) => data.category === "EQUIPEMENT" || Boolean(data.brandId) || Boolean(data.brandFreeText), {
    message: "Marque requise (catalogue ou texte libre)",
    path: ["brandId"],
  });

export type ListingInput = z.infer<typeof listingSchema>;

// Édition d'une annonce déjà publiée (Lot 30, étendu au Lot 35 pour couvrir
// catégorie/marque/modèle, Lot 73 pour les équipements) : seuls le prix (flux
// dédié depuis le Lot 23) et le téléphone en restent exclus.
export const listingEditSchema = listingBaseSchema
  .omit({ price: true, phone: true })
  .extend({ equipmentIds: equipmentIdsField })
  .superRefine((data, ctx) => {
    if (data.category !== "EQUIPEMENT") {
      if (!data.fuelType) ctx.addIssue({ code: "custom", path: ["fuelType"], message: "Carburant requis" });
      if (!data.gearbox) ctx.addIssue({ code: "custom", path: ["gearbox"], message: "Boîte de vitesses requise" });
      if (data.mileage === undefined) ctx.addIssue({ code: "custom", path: ["mileage"], message: "Kilométrage requis" });
    }
  })
  .refine((data) => data.category === "EQUIPEMENT" || Boolean(data.brandId) || Boolean(data.brandFreeText), {
    message: "Marque requise (catalogue ou texte libre)",
    path: ["brandId"],
  });

export type ListingEditInput = z.infer<typeof listingEditSchema>;
