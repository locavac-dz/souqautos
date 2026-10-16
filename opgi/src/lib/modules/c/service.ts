// Services du Module C : réclamations, commentaires, ordres de travail.
// Exécution DANS une transaction `withTenant` (cloisonnée par la RLS).
//
// Cloisonnement par PROPRIÉTÉ (au-delà de l'organisme) :
//  - un OCCUPANT ne voit/crée que SES réclamations (declarantUtilisateurId) ;
//  - un TECHNICIEN ne voit/modifie que SES ordres de travail ;
//  - les commentaires `interne` ne sont jamais renvoyés à un déclarant.
import { randomUUID } from "node:crypto";
import { ReferenceInvalideError, type Tx } from "@/lib/modules/a/service";
import type {
  ReclamationCreate,
  ReclamationQualifier,
  CommentaireCreate,
  OrdreCreate,
  OrdreUpdate,
} from "@/lib/modules/c/schemas";

/** Acteur courant (depuis la session vérifiée). */
export interface Acteur {
  utilisateurId: string;
  role: string;
}

function genRef(prefix: string): string {
  return `${prefix}-${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

// --- Réclamations -----------------------------------------------------------

/** Restriction de propriété pour un occupant (ses réclamations uniquement). */
function reclamationOwnership(acteur: Acteur) {
  return acteur.role === "OCCUPANT" ? { declarantUtilisateurId: acteur.utilisateurId } : {};
}

export async function createReclamation(
  tx: Tx,
  organisationId: string,
  acteur: Acteur,
  input: ReclamationCreate,
) {
  if (input.bienId) {
    const bien = await tx.bien.findFirst({ where: { id: input.bienId, organisationId } });
    if (!bien) throw new ReferenceInvalideError("Bien introuvable dans cet organisme.");
  }
  if (input.occupantId) {
    const occ = await tx.occupant.findFirst({ where: { id: input.occupantId, organisationId } });
    if (!occ) throw new ReferenceInvalideError("Occupant introuvable dans cet organisme.");
  }

  const estOccupant = acteur.role === "OCCUPANT";
  return tx.reclamation.create({
    data: {
      organisationId,
      reference: genRef("REC"),
      bienId: input.bienId ?? null,
      occupantId: input.occupantId ?? null,
      // Un occupant déclare toujours en son nom ; un agent peut saisir au guichet.
      declarantUtilisateurId: estOccupant ? acteur.utilisateurId : null,
      declarantNom: input.declarantNom ?? null,
      declarantContact: input.declarantContact ?? null,
      categorie: input.categorie,
      urgence: input.urgence ?? "NORMALE",
      canal: input.canal ?? (estOccupant ? "PORTAIL" : "GUICHET"),
      description: input.description,
      localisation: input.localisation ?? null,
    },
  });
}

export function listReclamations(
  tx: Tx,
  organisationId: string,
  acteur: Acteur,
  opts: { statut?: string; inclureArchives?: boolean } = {},
) {
  return tx.reclamation.findMany({
    where: {
      organisationId,
      ...reclamationOwnership(acteur),
      ...(opts.statut ? { statut: opts.statut as never } : {}),
      ...(opts.inclureArchives ? {} : { archiveLe: null }),
    },
    orderBy: { createdAt: "desc" },
  });
}

export function getReclamation(tx: Tx, organisationId: string, acteur: Acteur, id: string) {
  return tx.reclamation.findFirst({
    where: { id, organisationId, ...reclamationOwnership(acteur) },
  });
}

export async function qualifierReclamation(
  tx: Tx,
  organisationId: string,
  id: string,
  input: ReclamationQualifier,
) {
  const res = await tx.reclamation.updateMany({ where: { id, organisationId }, data: input });
  if (res.count === 0) return null;
  return tx.reclamation.findFirst({ where: { id, organisationId } });
}

/** Regroupe une réclamation comme doublon d'une autre (historique préservé). */
export async function marquerDoublon(
  tx: Tx,
  organisationId: string,
  id: string,
  doublonDeId: string,
) {
  if (id === doublonDeId) throw new ReferenceInvalideError("Une réclamation ne peut être son propre doublon.");
  const cible = await tx.reclamation.findFirst({ where: { id: doublonDeId, organisationId } });
  if (!cible) throw new ReferenceInvalideError("Réclamation cible introuvable dans cet organisme.");
  const res = await tx.reclamation.updateMany({
    where: { id, organisationId },
    data: { statut: "DOUBLON", doublonDeId },
  });
  if (res.count === 0) return null;
  return tx.reclamation.findFirst({ where: { id, organisationId } });
}

// --- Commentaires -----------------------------------------------------------

export async function addCommentaire(
  tx: Tx,
  organisationId: string,
  acteur: Acteur,
  reclamationId: string,
  input: CommentaireCreate,
) {
  const rec = await getReclamation(tx, organisationId, acteur, reclamationId);
  if (!rec) throw new ReferenceInvalideError("Réclamation introuvable.");
  // Un déclarant (occupant) ne peut pas écrire de note interne.
  const interne = acteur.role === "OCCUPANT" ? false : (input.interne ?? false);
  return tx.commentaireReclamation.create({
    data: {
      organisationId,
      reclamationId,
      auteurUtilisateurId: acteur.utilisateurId,
      texte: input.texte,
      interne,
    },
  });
}

export async function listCommentaires(
  tx: Tx,
  organisationId: string,
  acteur: Acteur,
  reclamationId: string,
) {
  const rec = await getReclamation(tx, organisationId, acteur, reclamationId);
  if (!rec) return null;
  return tx.commentaireReclamation.findMany({
    where: {
      organisationId,
      reclamationId,
      // Un occupant ne voit jamais les notes internes.
      ...(acteur.role === "OCCUPANT" ? { interne: false } : {}),
    },
    orderBy: { createdAt: "asc" },
  });
}

// --- Ordres de travail ------------------------------------------------------

function ordreOwnership(acteur: Acteur) {
  return acteur.role === "TECHNICIEN" ? { technicienUtilisateurId: acteur.utilisateurId } : {};
}

export async function createOrdre(tx: Tx, organisationId: string, input: OrdreCreate) {
  const rec = await tx.reclamation.findFirst({
    where: { id: input.reclamationId, organisationId },
  });
  if (!rec) throw new ReferenceInvalideError("Réclamation introuvable dans cet organisme.");
  return tx.ordreTravail.create({
    data: {
      organisationId,
      reclamationId: input.reclamationId,
      reference: genRef("OT"),
      affectationType: input.affectationType ?? null,
      technicienUtilisateurId: input.technicienUtilisateurId ?? null,
      prestataireNom: input.prestataireNom ?? null,
      datePlanifiee: input.datePlanifiee ?? null,
      coutEstimeCentimes: input.coutEstimeCentimes ?? null,
      compteRendu: input.compteRendu ?? null,
    },
  });
}

export function listOrdres(
  tx: Tx,
  organisationId: string,
  acteur: Acteur,
  opts: { reclamationId?: string; inclureArchives?: boolean } = {},
) {
  return tx.ordreTravail.findMany({
    where: {
      organisationId,
      ...ordreOwnership(acteur),
      ...(opts.reclamationId ? { reclamationId: opts.reclamationId } : {}),
      ...(opts.inclureArchives ? {} : { archiveLe: null }),
    },
    orderBy: { createdAt: "desc" },
  });
}

export function getOrdre(tx: Tx, organisationId: string, acteur: Acteur, id: string) {
  return tx.ordreTravail.findFirst({ where: { id, organisationId, ...ordreOwnership(acteur) } });
}

export async function updateOrdre(
  tx: Tx,
  organisationId: string,
  acteur: Acteur,
  id: string,
  input: OrdreUpdate,
) {
  // La restriction de propriété s'applique AUSSI à l'écriture : un technicien
  // ne peut modifier qu'un ordre qui lui est affecté.
  const res = await tx.ordreTravail.updateMany({
    where: { id, organisationId, ...ordreOwnership(acteur) },
    data: input,
  });
  if (res.count === 0) return null;
  return tx.ordreTravail.findFirst({ where: { id, organisationId } });
}
