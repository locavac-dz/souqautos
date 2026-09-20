import { z } from "zod";
import { INT4_MAX } from "./int-bounds";

// Une adresse email est la même adresse quelle que soit sa casse : « Ali@X.dz »
// et « ali@x.dz » ne doivent pas pouvoir devenir deux comptes (l'unicité de la
// base distingue les majuscules), ni l'un empêcher l'autre de se connecter. Elle
// est donc nettoyée (espaces, minuscules) AVANT d'être validée puis utilisée,
// à l'inscription comme à la connexion, à l'invitation d'un collaborateur et au
// changement d'adresse. Même règle côté base : migration
// `20260919110000_normalize_emails` (adresses existantes + index unique insensible à la casse).
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(255));

// Lot 133 — règle du mot de passe, commune à l'inscription et à la réinitialisation.
export const newPasswordSchema = z.string().min(8).max(200);

export const registerSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  email: emailSchema,
  password: newPasswordSchema,
  wilayaId: z.number().int().positive().max(INT4_MAX).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
});

export type LoginInput = z.infer<typeof loginSchema>;
