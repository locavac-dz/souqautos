// Schémas de validation (zod) du Module C — réclamations, commentaires, OT.
import { z } from "zod";

const CATEGORIE = [
  "PLOMBERIE",
  "ELECTRICITE",
  "MACONNERIE",
  "ASCENSEUR",
  "CHAUFFAGE",
  "PROPRETE",
  "AUTRE",
] as const;
const URGENCE = ["FAIBLE", "NORMALE", "HAUTE", "CRITIQUE"] as const;
const STATUT = ["NOUVELLE", "QUALIFIEE", "EN_COURS", "RESOLUE", "REJETEE", "DOUBLON"] as const;
const CANAL = ["PORTAIL", "GUICHET", "TELEPHONE", "EMAIL", "COURRIER", "AUTRE"] as const;
const AFFECTATION = ["INTERNE", "EXTERNE"] as const;
const STATUT_OT = ["OUVERT", "PLANIFIE", "EN_COURS", "CLOTURE", "ANNULE"] as const;

export const reclamationCreateSchema = z.object({
  bienId: z.string().min(1).nullish(),
  occupantId: z.string().min(1).nullish(),
  categorie: z.enum(CATEGORIE),
  urgence: z.enum(URGENCE).optional(),
  canal: z.enum(CANAL).optional(),
  description: z.string().trim().min(1).max(5000),
  localisation: z.string().trim().max(300).nullish(),
  declarantNom: z.string().trim().max(200).nullish(),
  declarantContact: z.string().trim().max(200).nullish(),
});
export type ReclamationCreate = z.infer<typeof reclamationCreateSchema>;

export const reclamationQualifierSchema = z
  .object({
    statut: z.enum(STATUT).optional(),
    urgence: z.enum(URGENCE).optional(),
    categorie: z.enum(CATEGORIE).optional(),
  })
  .refine((o) => Object.keys(o).length > 0, "Aucune modification fournie.");
export type ReclamationQualifier = z.infer<typeof reclamationQualifierSchema>;

export const doublonSchema = z.object({ doublonDeId: z.string().min(1) });

export const commentaireCreateSchema = z.object({
  texte: z.string().trim().min(1).max(5000),
  interne: z.boolean().optional(),
});
export type CommentaireCreate = z.infer<typeof commentaireCreateSchema>;

export const ordreCreateSchema = z.object({
  reclamationId: z.string().min(1),
  affectationType: z.enum(AFFECTATION).optional(),
  technicienUtilisateurId: z.string().trim().max(60).nullish(),
  prestataireUtilisateurId: z.string().trim().max(60).nullish(),
  prestataireNom: z.string().trim().max(200).nullish(),
  datePlanifiee: z.coerce.date().nullish(),
  coutEstimeCentimes: z.number().int().nonnegative().nullish(),
  compteRendu: z.string().trim().max(5000).nullish(),
});
export type OrdreCreate = z.infer<typeof ordreCreateSchema>;

export const ordreUpdateSchema = z
  .object({
    statut: z.enum(STATUT_OT).optional(),
    affectationType: z.enum(AFFECTATION).optional(),
    technicienUtilisateurId: z.string().trim().max(60).nullish(),
    prestataireNom: z.string().trim().max(200).nullish(),
    datePlanifiee: z.coerce.date().nullish(),
    coutEstimeCentimes: z.number().int().nonnegative().nullish(),
    coutConstateCentimes: z.number().int().nonnegative().nullish(),
    compteRendu: z.string().trim().max(5000).nullish(),
  })
  .refine((o) => Object.keys(o).length > 0, "Aucune modification fournie.");
export type OrdreUpdate = z.infer<typeof ordreUpdateSchema>;
