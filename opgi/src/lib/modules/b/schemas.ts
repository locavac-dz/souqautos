// Schémas de validation (zod) du Module B — projets, entreprises, marchés,
// situations de travaux, réceptions.
import { z } from "zod";

const STATUT_PROJET = ["EN_PREPARATION", "EN_COURS", "SUSPENDU", "CLOTURE"] as const;
const STATUT_MARCHE = ["EN_PREPARATION", "NOTIFIE", "EN_COURS", "RECEPTIONNE", "RESILIE", "CLOTURE"] as const;
const TYPE_RECEPTION = ["PROVISOIRE", "DEFINITIVE"] as const;

export const projetCreateSchema = z.object({
  code: z.string().trim().min(1).max(64),
  intitule: z.string().trim().min(1).max(300),
  programme: z.string().trim().max(200).nullish(),
  sourceFinancement: z.string().trim().max(200).nullish(),
  statut: z.enum(STATUT_PROJET).optional(),
  montantInitialCentimes: z.number().int().nonnegative().nullish(),
  dateDebut: z.coerce.date().nullish(),
  dateFinPrevue: z.coerce.date().nullish(),
});
export const projetUpdateSchema = projetCreateSchema.partial();
export type ProjetCreate = z.infer<typeof projetCreateSchema>;
export type ProjetUpdate = z.infer<typeof projetUpdateSchema>;

export const entrepriseCreateSchema = z.object({
  raisonSociale: z.string().trim().min(1).max(300),
  nif: z.string().trim().max(50).nullish(),
  rc: z.string().trim().max(50).nullish(),
  contact: z.string().trim().max(200).nullish(),
});
export const entrepriseUpdateSchema = entrepriseCreateSchema.partial();
export type EntrepriseCreate = z.infer<typeof entrepriseCreateSchema>;
export type EntrepriseUpdate = z.infer<typeof entrepriseUpdateSchema>;

export const marcheCreateSchema = z.object({
  reference: z.string().trim().min(1).max(64),
  projetId: z.string().min(1),
  entrepriseId: z.string().min(1),
  objet: z.string().trim().min(1).max(500),
  montantCentimes: z.number().int().positive(),
  dateNotification: z.coerce.date().nullish(),
  delaiJours: z.number().int().positive().nullish(),
  statut: z.enum(STATUT_MARCHE).optional(),
});
export const marcheUpdateSchema = z
  .object({
    objet: z.string().trim().min(1).max(500).optional(),
    montantCentimes: z.number().int().positive().optional(),
    dateNotification: z.coerce.date().nullish(),
    delaiJours: z.number().int().positive().nullish(),
    statut: z.enum(STATUT_MARCHE).optional(),
  })
  .refine((o) => Object.keys(o).length > 0, "Aucune modification fournie.");
export type MarcheCreate = z.infer<typeof marcheCreateSchema>;
export type MarcheUpdate = z.infer<typeof marcheUpdateSchema>;

export const situationCreateSchema = z.object({
  numero: z.number().int().positive(),
  periode: z.string().trim().max(20).nullish(),
  montantTravauxCentimes: z.number().int().nonnegative(),
  avancementPhysiquePct: z.number().int().min(0).max(100).nullish(),
  observations: z.string().trim().max(2000).nullish(),
  dateDepot: z.coerce.date(),
});
export type SituationCreate = z.infer<typeof situationCreateSchema>;

// Décision sur une situation : VERIFIEE/REJETEE (modifier) ou VALIDEE (valider).
export const situationDecisionSchema = z.object({
  decision: z.enum(["VERIFIEE", "VALIDEE", "REJETEE"]),
  observations: z.string().trim().max(2000).nullish(),
});
export type SituationDecision = z.infer<typeof situationDecisionSchema>;

export const receptionCreateSchema = z.object({
  type: z.enum(TYPE_RECEPTION),
  date: z.coerce.date(),
  avecReserves: z.boolean().optional(),
  observations: z.string().trim().max(2000).nullish(),
  pvReference: z.string().trim().max(120).nullish(),
});
export type ReceptionCreate = z.infer<typeof receptionCreateSchema>;
