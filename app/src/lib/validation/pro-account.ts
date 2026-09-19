import { z } from "zod";
import { INT4_MAX } from "./int-bounds";

// Champs modifiables d'un compte pro — partagé entre la création (POST
// /api/pro/accounts) et l'édition (PATCH /api/pro/accounts/[id]) pour que les
// deux ne divergent jamais. `badgeVerifie` n'en fait volontairement PAS
// partie : il ne se règle que côté back-office.
export const proAccountFieldsSchema = z.object({
  nomCommercial: z.string().trim().min(2).max(100),
  presentation: z.string().trim().max(2000).optional(),
  horaires: z.string().trim().max(200).optional(),
  wilayaId: z.number().int().max(INT4_MAX).nullable().optional(),
});
