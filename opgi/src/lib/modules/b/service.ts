// Services du Module B : projets, entreprises, marchés, situations de travaux,
// réceptions. Exécution DANS une transaction `withTenant` (cloisonnée RLS).
//
// Séparation ENGAGÉ / CONSTATÉ / PAYÉ :
//  - engagé   = montant du marché ;
//  - constaté = somme des situations VALIDÉES ;
//  - payé     = HORS PÉRIMÈTRE (aucun paiement exécuté ici).
// Aucun calcul réglementaire : l'avancement et les alertes sont indicatifs.
import { ReferenceInvalideError, type Tx, type ListeOpts } from "@/lib/modules/a/service";
import type {
  ProjetCreate,
  ProjetUpdate,
  EntrepriseCreate,
  EntrepriseUpdate,
  MarcheCreate,
  MarcheUpdate,
  SituationCreate,
  ReceptionCreate,
} from "@/lib/modules/b/schemas";

// --- Projets ----------------------------------------------------------------
function whereProjets(organisationId: string, o: ListeOpts) {
  return {
    organisationId,
    ...(o.inclureArchives ? {} : { archiveLe: null }),
    ...(o.q
      ? {
          OR: [
            { code: { contains: o.q, mode: "insensitive" as const } },
            { intitule: { contains: o.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
}
export function listProjets(tx: Tx, organisationId: string, o: ListeOpts = {}) {
  return tx.projet.findMany({
    where: whereProjets(organisationId, o),
    orderBy: { code: "asc" },
    skip: o.skip,
    take: o.take,
  });
}
export function countProjets(tx: Tx, organisationId: string, o: ListeOpts = {}) {
  return tx.projet.count({ where: whereProjets(organisationId, o) });
}
export function getProjet(tx: Tx, organisationId: string, id: string) {
  return tx.projet.findFirst({ where: { id, organisationId } });
}
export function createProjet(tx: Tx, organisationId: string, input: ProjetCreate) {
  return tx.projet.create({
    data: {
      organisationId,
      code: input.code,
      intitule: input.intitule,
      programme: input.programme ?? null,
      sourceFinancement: input.sourceFinancement ?? null,
      statut: input.statut ?? "EN_PREPARATION",
      montantInitialCentimes: input.montantInitialCentimes ?? null,
      dateDebut: input.dateDebut ?? null,
      dateFinPrevue: input.dateFinPrevue ?? null,
    },
  });
}
export async function updateProjet(tx: Tx, organisationId: string, id: string, input: ProjetUpdate) {
  const res = await tx.projet.updateMany({ where: { id, organisationId }, data: input });
  if (res.count === 0) return null;
  return getProjet(tx, organisationId, id);
}
export async function archiveProjet(tx: Tx, organisationId: string, id: string) {
  const res = await tx.projet.updateMany({
    where: { id, organisationId, archiveLe: null },
    data: { archiveLe: new Date() },
  });
  return res.count > 0;
}

// --- Entreprises ------------------------------------------------------------
function whereEntreprises(organisationId: string, o: ListeOpts) {
  return {
    organisationId,
    ...(o.inclureArchives ? {} : { archiveLe: null }),
    ...(o.q
      ? {
          OR: [
            { raisonSociale: { contains: o.q, mode: "insensitive" as const } },
            { nif: { contains: o.q, mode: "insensitive" as const } },
            { rc: { contains: o.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
}
export function listEntreprises(tx: Tx, organisationId: string, o: ListeOpts = {}) {
  return tx.entreprise.findMany({
    where: whereEntreprises(organisationId, o),
    orderBy: { raisonSociale: "asc" },
    skip: o.skip,
    take: o.take,
  });
}
export function countEntreprises(tx: Tx, organisationId: string, o: ListeOpts = {}) {
  return tx.entreprise.count({ where: whereEntreprises(organisationId, o) });
}
export function getEntreprise(tx: Tx, organisationId: string, id: string) {
  return tx.entreprise.findFirst({ where: { id, organisationId } });
}
export function createEntreprise(tx: Tx, organisationId: string, input: EntrepriseCreate) {
  return tx.entreprise.create({
    data: {
      organisationId,
      raisonSociale: input.raisonSociale,
      nif: input.nif ?? null,
      rc: input.rc ?? null,
      contact: input.contact ?? null,
    },
  });
}
export async function updateEntreprise(tx: Tx, organisationId: string, id: string, input: EntrepriseUpdate) {
  const res = await tx.entreprise.updateMany({ where: { id, organisationId }, data: input });
  if (res.count === 0) return null;
  return getEntreprise(tx, organisationId, id);
}
export async function archiveEntreprise(tx: Tx, organisationId: string, id: string) {
  const res = await tx.entreprise.updateMany({
    where: { id, organisationId, archiveLe: null },
    data: { archiveLe: new Date() },
  });
  return res.count > 0;
}

// --- Marchés ----------------------------------------------------------------
export interface MarcheListeOpts extends ListeOpts {
  projetId?: string;
}
function whereMarches(organisationId: string, opts: MarcheListeOpts) {
  return {
    organisationId,
    ...(opts.projetId ? { projetId: opts.projetId } : {}),
    ...(opts.inclureArchives ? {} : { archiveLe: null }),
    ...(opts.q
      ? {
          OR: [
            { reference: { contains: opts.q, mode: "insensitive" as const } },
            { objet: { contains: opts.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
}
export function listMarches(tx: Tx, organisationId: string, opts: MarcheListeOpts = {}) {
  return tx.marche.findMany({
    where: whereMarches(organisationId, opts),
    orderBy: { reference: "asc" },
    skip: opts.skip,
    take: opts.take,
  });
}
export function countMarches(tx: Tx, organisationId: string, opts: MarcheListeOpts = {}) {
  return tx.marche.count({ where: whereMarches(organisationId, opts) });
}

export async function createMarche(tx: Tx, organisationId: string, input: MarcheCreate) {
  const projet = await tx.projet.findFirst({ where: { id: input.projetId, organisationId, archiveLe: null } });
  if (!projet) throw new ReferenceInvalideError("Projet introuvable dans cet organisme.");
  const entreprise = await tx.entreprise.findFirst({ where: { id: input.entrepriseId, organisationId, archiveLe: null } });
  if (!entreprise) throw new ReferenceInvalideError("Entreprise introuvable dans cet organisme.");
  return tx.marche.create({
    data: {
      organisationId,
      reference: input.reference,
      projetId: input.projetId,
      entrepriseId: input.entrepriseId,
      objet: input.objet,
      montantCentimes: input.montantCentimes,
      dateNotification: input.dateNotification ?? null,
      delaiJours: input.delaiJours ?? null,
      statut: input.statut ?? "EN_PREPARATION",
    },
  });
}
export async function updateMarche(tx: Tx, organisationId: string, id: string, input: MarcheUpdate) {
  const res = await tx.marche.updateMany({ where: { id, organisationId }, data: input });
  if (res.count === 0) return null;
  return tx.marche.findFirst({ where: { id, organisationId } });
}
export async function archiveMarche(tx: Tx, organisationId: string, id: string) {
  const res = await tx.marche.updateMany({
    where: { id, organisationId, archiveLe: null },
    data: { archiveLe: new Date() },
  });
  return res.count > 0;
}

export interface MarcheDetail {
  marche: {
    id: string;
    reference: string;
    objet: string;
    montantCentimes: number;
    statut: string;
    dateNotification: Date | null;
    delaiJours: number | null;
  };
  // Indicateurs (indicatifs, non réglementaires).
  montantEngageCentimes: number;
  montantConstateValideCentimes: number;
  avancementFinancierPct: number;
  avancementPhysiquePct: number | null;
  depassement: boolean;
  retard: boolean;
}

/** Détail d'un marché avec indicateurs d'avancement et alertes indicatives. */
export async function getMarcheDetail(
  tx: Tx,
  organisationId: string,
  id: string,
  maintenant: Date = new Date(),
): Promise<MarcheDetail | null> {
  const marche = await tx.marche.findFirst({ where: { id, organisationId } });
  if (!marche) return null;

  const valides = await tx.situationTravaux.findMany({
    where: { organisationId, marcheId: id, statut: "VALIDEE", archiveLe: null },
    orderBy: { numero: "asc" },
  });
  const montantConstate = valides.reduce((s, v) => s + v.montantTravauxCentimes, 0);
  const avancementPhysique = valides.reduce<number | null>(
    (acc, v) => (v.avancementPhysiquePct != null ? v.avancementPhysiquePct : acc),
    null,
  );
  const avancementFinancierPct =
    marche.montantCentimes > 0 ? Math.round((montantConstate / marche.montantCentimes) * 100) : 0;

  const finActive = marche.statut !== "RECEPTIONNE" && marche.statut !== "CLOTURE" && marche.statut !== "RESILIE";
  const retard =
    finActive && marche.dateNotification != null && marche.delaiJours != null
      ? marche.dateNotification.getTime() + marche.delaiJours * 24 * 60 * 60 * 1000 < maintenant.getTime()
      : false;

  return {
    marche: {
      id: marche.id,
      reference: marche.reference,
      objet: marche.objet,
      montantCentimes: marche.montantCentimes,
      statut: marche.statut,
      dateNotification: marche.dateNotification,
      delaiJours: marche.delaiJours,
    },
    montantEngageCentimes: marche.montantCentimes,
    montantConstateValideCentimes: montantConstate,
    avancementFinancierPct,
    avancementPhysiquePct: avancementPhysique,
    depassement: montantConstate > marche.montantCentimes,
    retard,
  };
}

// --- Situations de travaux --------------------------------------------------
export function listSituations(tx: Tx, organisationId: string, marcheId: string) {
  return tx.situationTravaux.findMany({
    where: { organisationId, marcheId, archiveLe: null },
    orderBy: { numero: "asc" },
  });
}

export async function createSituation(tx: Tx, organisationId: string, marcheId: string, input: SituationCreate) {
  const marche = await tx.marche.findFirst({ where: { id: marcheId, organisationId, archiveLe: null } });
  if (!marche) throw new ReferenceInvalideError("Marché introuvable dans cet organisme.");
  return tx.situationTravaux.create({
    data: {
      organisationId,
      marcheId,
      numero: input.numero,
      periode: input.periode ?? null,
      montantTravauxCentimes: input.montantTravauxCentimes,
      avancementPhysiquePct: input.avancementPhysiquePct ?? null,
      observations: input.observations ?? null,
      dateDepot: input.dateDepot,
      statut: "DEPOSEE",
    },
  });
}

/**
 * Enregistre une décision sur une situation (VERIFIEE/VALIDEE/REJETEE) et trace
 * le décideur + la date. L'autorisation (valider vs modifier) est contrôlée par
 * le handler : VALIDEE exige la permission « valider ».
 */
export async function deciderSituation(
  tx: Tx,
  organisationId: string,
  id: string,
  decision: "VERIFIEE" | "VALIDEE" | "REJETEE",
  decideurUtilisateurId: string,
  observations?: string | null,
) {
  const res = await tx.situationTravaux.updateMany({
    where: { id, organisationId },
    data: {
      statut: decision,
      dateDecision: new Date(),
      decideurUtilisateurId,
      ...(observations != null ? { observations } : {}),
    },
  });
  if (res.count === 0) return null;
  return tx.situationTravaux.findFirst({ where: { id, organisationId } });
}

// --- Réceptions -------------------------------------------------------------
export function listReceptions(tx: Tx, organisationId: string, marcheId: string) {
  return tx.reception.findMany({
    where: { organisationId, marcheId },
    orderBy: { date: "asc" },
  });
}
export async function createReception(tx: Tx, organisationId: string, marcheId: string, input: ReceptionCreate) {
  const marche = await tx.marche.findFirst({ where: { id: marcheId, organisationId, archiveLe: null } });
  if (!marche) throw new ReferenceInvalideError("Marché introuvable dans cet organisme.");
  return tx.reception.create({
    data: {
      organisationId,
      marcheId,
      type: input.type,
      date: input.date,
      avecReserves: input.avecReserves ?? false,
      observations: input.observations ?? null,
      pvReference: input.pvReference ?? null,
    },
  });
}
