// Service des pièces jointes de réclamations (accès médié). Le contrôle de
// propriété de la réclamation (occupant → ses réclamations) est hérité de
// getReclamation ; une pièce n'est listable/téléchargeable que si la
// réclamation parente est visible pour l'acteur.
import type { Tx } from "@/lib/modules/a/service";
import { getReclamation, type Acteur } from "@/lib/modules/c/service";

export const MIMES_AUTORISES: ReadonlySet<string> = new Set([
  "image/jpeg",
  "image/png",
  "application/pdf",
]);
export const TAILLE_MAX_OCTETS = 10 * 1024 * 1024; // 10 Mo

export interface NouvellePiece {
  reclamationId: string;
  nomFichier: string;
  typeMime: string;
  tailleOctets: number;
  cleStockage: string;
  auteurUtilisateurId: string | null;
}

/** Crée la ligne après vérification que la réclamation est visible pour l'acteur. */
export async function creerPieceRow(tx: Tx, organisationId: string, acteur: Acteur, p: NouvellePiece) {
  const rec = await getReclamation(tx, organisationId, acteur, p.reclamationId);
  if (!rec) return null; // réclamation absente ou hors périmètre de l'acteur
  return tx.pieceJointe.create({
    data: {
      organisationId,
      reclamationId: p.reclamationId,
      nomFichier: p.nomFichier,
      typeMime: p.typeMime,
      tailleOctets: p.tailleOctets,
      cleStockage: p.cleStockage,
      auteurUtilisateurId: p.auteurUtilisateurId,
    },
  });
}

export async function listPieces(tx: Tx, organisationId: string, acteur: Acteur, reclamationId: string) {
  const rec = await getReclamation(tx, organisationId, acteur, reclamationId);
  if (!rec) return null;
  return tx.pieceJointe.findMany({
    where: { organisationId, reclamationId },
    orderBy: { createdAt: "asc" },
    select: { id: true, nomFichier: true, typeMime: true, tailleOctets: true, createdAt: true },
  });
}

/** Renvoie la pièce si (et seulement si) sa réclamation est visible pour l'acteur. */
export async function getPieceAutorisee(tx: Tx, organisationId: string, acteur: Acteur, id: string) {
  const piece = await tx.pieceJointe.findFirst({ where: { id, organisationId } });
  if (!piece) return null;
  const rec = await getReclamation(tx, organisationId, acteur, piece.reclamationId);
  if (!rec) return null;
  return piece;
}
