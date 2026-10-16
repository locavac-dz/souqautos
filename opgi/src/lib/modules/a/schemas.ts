// Schémas de validation (zod) du Module A — patrimoine, occupants, contrats.
import { z } from "zod";

const TYPE_BIEN = ["LOGEMENT", "LOCAL_COMMERCIAL", "GARAGE", "AUTRE"] as const;
const ETAT = ["OCCUPE", "VACANT", "INDISPONIBLE"] as const;
const TYPE_OCCUPANT = ["PHYSIQUE", "MORALE"] as const;
const STATUT_CONTRAT = ["BROUILLON", "ACTIF", "SUSPENDU", "RESILIE"] as const;

// --- Bien -------------------------------------------------------------------
export const bienCreateSchema = z.object({
  code: z.string().trim().min(1).max(64),
  type: z.enum(TYPE_BIEN),
  etatOccupation: z.enum(ETAT).optional(),
  adresse: z.string().trim().max(500).nullish(),
});
export const bienUpdateSchema = bienCreateSchema.partial();
export type BienCreate = z.infer<typeof bienCreateSchema>;
export type BienUpdate = z.infer<typeof bienUpdateSchema>;

// --- Occupant ---------------------------------------------------------------
export const occupantCreateSchema = z.object({
  type: z.enum(TYPE_OCCUPANT).optional(),
  nom: z.string().trim().min(1).max(200),
  prenom: z.string().trim().max(200).nullish(),
  telephone: z.string().trim().max(40).nullish(),
  email: z.string().trim().toLowerCase().email().max(200).nullish(),
});
export const occupantUpdateSchema = occupantCreateSchema.partial();
export type OccupantCreate = z.infer<typeof occupantCreateSchema>;
export type OccupantUpdate = z.infer<typeof occupantUpdateSchema>;

// --- Contrat ----------------------------------------------------------------
const dateInterval = { message: "La date de fin précède la date de début.", path: ["dateFin"] };

export const contratCreateSchema = z
  .object({
    reference: z.string().trim().min(1).max(64),
    bienId: z.string().min(1),
    occupantId: z.string().min(1),
    statut: z.enum(STATUT_CONTRAT).optional(),
    dateDebut: z.coerce.date(),
    dateFin: z.coerce.date().nullish(),
    // Saisie libre (aucun calcul) — centimes DZD, paramétrable.
    montantLoyerCentimes: z.number().int().nonnegative().nullish(),
  })
  .refine((c) => !c.dateFin || c.dateFin >= c.dateDebut, dateInterval);

export const contratUpdateSchema = z
  .object({
    reference: z.string().trim().min(1).max(64).optional(),
    statut: z.enum(STATUT_CONTRAT).optional(),
    dateDebut: z.coerce.date().optional(),
    dateFin: z.coerce.date().nullish(),
    montantLoyerCentimes: z.number().int().nonnegative().nullish(),
  })
  .refine((c) => !c.dateDebut || !c.dateFin || c.dateFin >= c.dateDebut, dateInterval);

export const statutContratSchema = z.object({ statut: z.enum(STATUT_CONTRAT) });

export type ContratCreate = z.infer<typeof contratCreateSchema>;
export type ContratUpdate = z.infer<typeof contratUpdateSchema>;
