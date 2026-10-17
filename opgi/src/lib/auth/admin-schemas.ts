// Schémas de validation (zod) de l'administration des comptes d'un organisme.
// Le rôle ADMIN_PLATEFORME (technique, transverse) n'est jamais attribuable
// depuis l'administration d'un organisme — séparation technique ↔ métier.
import { z } from "zod";

export const ROLES_ATTRIBUABLES = [
  "ADMIN_OPGI",
  "DIRECTION",
  "AGENT_LOCATIF",
  "AGENT_RECOUVREMENT",
  "CHEF_PROJET",
  "GESTIONNAIRE_MARCHES",
  "RESP_RECLAMATIONS",
  "TECHNICIEN",
  "PRESTATAIRE",
  "OCCUPANT",
  "AUDITEUR",
] as const;

export const utilisateurCreateSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  role: z.enum(ROLES_ATTRIBUABLES),
  // Longueur minimale appliquée côté handler (politique configurable).
  password: z.string().min(1).max(200),
  perimetre: z.string().trim().max(120).nullish(),
});
export type UtilisateurCreate = z.infer<typeof utilisateurCreateSchema>;

export const utilisateurUpdateSchema = z
  .object({
    role: z.enum(ROLES_ATTRIBUABLES).optional(),
    actif: z.boolean().optional(),
    perimetre: z.string().trim().max(120).nullish(),
  })
  .refine((o) => o.role !== undefined || o.actif !== undefined || o.perimetre !== undefined, {
    message: "Aucun champ à modifier.",
  });
export type UtilisateurUpdate = z.infer<typeof utilisateurUpdateSchema>;

export const resetMotDePasseSchema = z.object({
  password: z.string().min(1).max(200),
});
export type ResetMotDePasse = z.infer<typeof resetMotDePasseSchema>;
