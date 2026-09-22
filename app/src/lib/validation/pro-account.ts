import { z } from "zod";
import { INT4_MAX } from "./int-bounds";

export const PRO_CATEGORIES = [
  "CONCESSIONNAIRE_NEUF",
  "OCCASION",
  "GARAGE",
  "IMPORTATEUR",
  "PIECES_DETACHEES",
] as const;
export type ProCategory = (typeof PRO_CATEGORIES)[number];

// Champs modifiables d'un compte pro — partagé entre la création (POST
// /api/pro/accounts) et l'édition (PATCH /api/pro/accounts/[id]) pour que les
// deux ne divergent jamais. `badgeVerifie` n'en fait volontairement PAS
// partie : il ne se règle que côté back-office.
export const proAccountFieldsSchema = z.object({
  nomCommercial: z.string().trim().min(2).max(100),
  presentation: z.string().trim().max(2000).optional(),
  horaires: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(20).optional(),
  website: z.string().trim().url().max(200).optional().or(z.literal("")),
  categoryPro: z.enum(PRO_CATEGORIES).nullable().optional(),
  wilayaId: z.number().int().max(INT4_MAX).nullable().optional(),
});
