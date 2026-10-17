// Services financiers du Module A : appels de loyers, paiements, imputations,
// recouvrement. S'exécutent DANS une transaction `withTenant` (déjà cloisonnée
// par la RLS). Montants en centimes (entiers) — aucun flottant, aucun calcul de
// pénalité/intérêt. Le solde d'un appel et le reste d'un paiement sont calculés
// par différence avec les imputations (jamais stockés).
import { ReferenceInvalideError, RegleMetierError, type Tx } from "@/lib/modules/a/service";
import type {
  AppelCreate,
  AppelsGenererInput,
  PaiementCreate,
  ImputationCreate,
  ActionRecouvrementCreate,
} from "@/lib/modules/a/schemas";

// --- Helpers de calcul ------------------------------------------------------

async function imputeParAppel(tx: Tx, organisationId: string, appelIds: string[]) {
  if (appelIds.length === 0) return new Map<string, number>();
  const rows = await tx.imputation.groupBy({
    by: ["appelId"],
    where: { organisationId, appelId: { in: appelIds } },
    _sum: { montantCentimes: true },
  });
  return new Map(rows.map((r) => [r.appelId, r._sum.montantCentimes ?? 0]));
}

async function imputeParPaiement(tx: Tx, organisationId: string, paiementIds: string[]) {
  if (paiementIds.length === 0) return new Map<string, number>();
  const rows = await tx.imputation.groupBy({
    by: ["paiementId"],
    where: { organisationId, paiementId: { in: paiementIds } },
    _sum: { montantCentimes: true },
  });
  return new Map(rows.map((r) => [r.paiementId, r._sum.montantCentimes ?? 0]));
}

// --- Appels de loyers -------------------------------------------------------

export async function createAppel(tx: Tx, organisationId: string, input: AppelCreate) {
  const contrat = await tx.contrat.findFirst({
    where: { id: input.contratId, organisationId, archiveLe: null },
  });
  if (!contrat) throw new ReferenceInvalideError("Contrat introuvable dans cet organisme.");

  // Par défaut, le montant de l'appel = loyer du contrat (saisie libre sinon).
  const montant = input.montantCentimes ?? contrat.montantLoyerCentimes;
  if (montant == null || montant <= 0) {
    throw new RegleMetierError("Montant de l'appel absent (aucun loyer défini sur le contrat).");
  }

  return tx.appelLoyer.create({
    data: {
      organisationId,
      contratId: input.contratId,
      periode: input.periode,
      libelle: input.libelle ?? null,
      montantCentimes: montant,
      dateEcheance: input.dateEcheance,
    },
  });
}

export interface GenerationAppelsResume {
  periode: string;
  /** Contrats ACTIFS de l'organisme considérés. */
  contratsActifs: number;
  /** Appels créés par cette génération. */
  crees: number;
  /** Contrats déjà pourvus d'un appel pour cette période (ignorés). */
  ignoresExistants: number;
  /** Contrats actifs sans loyer défini (> 0) donc ignorés. */
  ignoresSansLoyer: number;
}

/**
 * Génère, pour une période donnée, un appel par contrat ACTIF au montant du
 * loyer du contrat. Opération purement mécanique : aucun calcul de pénalité,
 * d'intérêt ni de proratisation. Idempotente — un contrat déjà pourvu d'un
 * appel pour la période est ignoré (contrainte unique organisme+contrat+période).
 */
export async function genererAppels(
  tx: Tx,
  organisationId: string,
  input: AppelsGenererInput,
): Promise<GenerationAppelsResume> {
  const contrats = await tx.contrat.findMany({
    where: { organisationId, statut: "ACTIF", archiveLe: null },
    select: { id: true, montantLoyerCentimes: true },
  });
  const existants = await tx.appelLoyer.findMany({
    where: { organisationId, periode: input.periode },
    select: { contratId: true },
  });
  const dejaAppel = new Set(existants.map((e) => e.contratId));

  let ignoresExistants = 0;
  let ignoresSansLoyer = 0;
  const aCreer = [];
  for (const c of contrats) {
    if (dejaAppel.has(c.id)) {
      ignoresExistants++;
      continue;
    }
    if (c.montantLoyerCentimes == null || c.montantLoyerCentimes <= 0) {
      ignoresSansLoyer++;
      continue;
    }
    aCreer.push({
      organisationId,
      contratId: c.id,
      periode: input.periode,
      libelle: input.libelle ?? null,
      montantCentimes: c.montantLoyerCentimes,
      dateEcheance: input.dateEcheance,
    });
  }
  if (aCreer.length > 0) {
    // skipDuplicates : filet contre une génération concurrente sur la même période.
    await tx.appelLoyer.createMany({ data: aCreer, skipDuplicates: true });
  }
  return {
    periode: input.periode,
    contratsActifs: contrats.length,
    crees: aCreer.length,
    ignoresExistants,
    ignoresSansLoyer,
  };
}

export interface AppelAvecSolde {
  id: string;
  contratId: string;
  periode: string;
  libelle: string | null;
  montantCentimes: number;
  dateEcheance: Date;
  imputeCentimes: number;
  soldeCentimes: number;
}

export async function listAppels(
  tx: Tx,
  organisationId: string,
  opts: { contratId?: string; inclureArchives?: boolean } = {},
): Promise<AppelAvecSolde[]> {
  const appels = await tx.appelLoyer.findMany({
    where: {
      organisationId,
      ...(opts.contratId ? { contratId: opts.contratId } : {}),
      ...(opts.inclureArchives ? {} : { archiveLe: null }),
    },
    orderBy: [{ periode: "asc" }],
  });
  const impute = await imputeParAppel(
    tx,
    organisationId,
    appels.map((a) => a.id),
  );
  return appels.map((a) => {
    const imputeCentimes = impute.get(a.id) ?? 0;
    return {
      id: a.id,
      contratId: a.contratId,
      periode: a.periode,
      libelle: a.libelle,
      montantCentimes: a.montantCentimes,
      dateEcheance: a.dateEcheance,
      imputeCentimes,
      soldeCentimes: a.montantCentimes - imputeCentimes,
    };
  });
}

export async function archiveAppel(tx: Tx, organisationId: string, id: string) {
  const res = await tx.appelLoyer.updateMany({
    where: { id, organisationId, archiveLe: null },
    data: { archiveLe: new Date() },
  });
  return res.count > 0;
}

// --- Paiements --------------------------------------------------------------

export async function createPaiement(tx: Tx, organisationId: string, input: PaiementCreate) {
  const contrat = await tx.contrat.findFirst({
    where: { id: input.contratId, organisationId, archiveLe: null },
  });
  if (!contrat) throw new ReferenceInvalideError("Contrat introuvable dans cet organisme.");
  return tx.paiement.create({
    data: {
      organisationId,
      contratId: input.contratId,
      montantCentimes: input.montantCentimes,
      datePaiement: input.datePaiement,
      mode: input.mode ?? "VIREMENT",
      reference: input.reference ?? null,
      note: input.note ?? null,
    },
  });
}

export interface PaiementAvecReste {
  id: string;
  contratId: string;
  montantCentimes: number;
  datePaiement: Date;
  mode: string;
  reference: string | null;
  imputeCentimes: number;
  resteCentimes: number;
}

export async function listPaiements(
  tx: Tx,
  organisationId: string,
  opts: { contratId?: string; inclureArchives?: boolean } = {},
): Promise<PaiementAvecReste[]> {
  const paiements = await tx.paiement.findMany({
    where: {
      organisationId,
      ...(opts.contratId ? { contratId: opts.contratId } : {}),
      ...(opts.inclureArchives ? {} : { archiveLe: null }),
    },
    orderBy: [{ datePaiement: "desc" }],
  });
  const impute = await imputeParPaiement(
    tx,
    organisationId,
    paiements.map((p) => p.id),
  );
  return paiements.map((p) => {
    const imputeCentimes = impute.get(p.id) ?? 0;
    return {
      id: p.id,
      contratId: p.contratId,
      montantCentimes: p.montantCentimes,
      datePaiement: p.datePaiement,
      mode: p.mode,
      reference: p.reference,
      imputeCentimes,
      resteCentimes: p.montantCentimes - imputeCentimes,
    };
  });
}

export async function archivePaiement(tx: Tx, organisationId: string, id: string) {
  const res = await tx.paiement.updateMany({
    where: { id, organisationId, archiveLe: null },
    data: { archiveLe: new Date() },
  });
  return res.count > 0;
}

// --- Imputations ------------------------------------------------------------

export async function createImputation(tx: Tx, organisationId: string, input: ImputationCreate) {
  const paiement = await tx.paiement.findFirst({
    where: { id: input.paiementId, organisationId, archiveLe: null },
  });
  if (!paiement) throw new ReferenceInvalideError("Paiement introuvable dans cet organisme.");
  const appel = await tx.appelLoyer.findFirst({
    where: { id: input.appelId, organisationId, archiveLe: null },
  });
  if (!appel) throw new ReferenceInvalideError("Appel de loyer introuvable dans cet organisme.");

  // Un paiement ne s'impute que sur des appels du MÊME contrat.
  if (paiement.contratId !== appel.contratId) {
    throw new RegleMetierError("Le paiement et l'appel appartiennent à des contrats différents.");
  }

  const [dejaAppel, dejaPaiement] = await Promise.all([
    imputeParAppel(tx, organisationId, [appel.id]),
    imputeParPaiement(tx, organisationId, [paiement.id]),
  ]);
  const soldeAppel = appel.montantCentimes - (dejaAppel.get(appel.id) ?? 0);
  const restePaiement = paiement.montantCentimes - (dejaPaiement.get(paiement.id) ?? 0);

  if (input.montantCentimes > soldeAppel) {
    throw new RegleMetierError("L'imputation dépasse le solde restant dû de l'appel.");
  }
  if (input.montantCentimes > restePaiement) {
    throw new RegleMetierError("L'imputation dépasse le reste disponible du paiement.");
  }

  return tx.imputation.create({
    data: {
      organisationId,
      paiementId: input.paiementId,
      appelId: input.appelId,
      montantCentimes: input.montantCentimes,
    },
  });
}

export async function deleteImputation(tx: Tx, organisationId: string, id: string) {
  const res = await tx.imputation.deleteMany({ where: { id, organisationId } });
  return res.count > 0;
}

// --- Recouvrement -----------------------------------------------------------

export interface ImpayeLigne extends AppelAvecSolde {
  contratReference: string;
  bienCode: string;
  occupantNom: string;
  joursRetard: number;
}

/** Liste des appels non soldés (solde > 0). `joursRetard` est indicatif. */
export async function listImpayes(
  tx: Tx,
  organisationId: string,
  maintenant: Date = new Date(),
): Promise<ImpayeLigne[]> {
  const appels = await tx.appelLoyer.findMany({
    where: { organisationId, archiveLe: null },
    orderBy: [{ dateEcheance: "asc" }],
    include: {
      contrat: { select: { reference: true, bien: { select: { code: true } }, occupant: { select: { nom: true } } } },
    },
  });
  const impute = await imputeParAppel(
    tx,
    organisationId,
    appels.map((a) => a.id),
  );
  const jour = 24 * 60 * 60 * 1000;
  return appels
    .map((a) => {
      const imputeCentimes = impute.get(a.id) ?? 0;
      const soldeCentimes = a.montantCentimes - imputeCentimes;
      const joursRetard =
        soldeCentimes > 0 && a.dateEcheance < maintenant
          ? Math.floor((maintenant.getTime() - a.dateEcheance.getTime()) / jour)
          : 0;
      return {
        id: a.id,
        contratId: a.contratId,
        periode: a.periode,
        libelle: a.libelle,
        montantCentimes: a.montantCentimes,
        dateEcheance: a.dateEcheance,
        imputeCentimes,
        soldeCentimes,
        contratReference: a.contrat.reference,
        bienCode: a.contrat.bien.code,
        occupantNom: a.contrat.occupant.nom,
        joursRetard,
      };
    })
    .filter((a) => a.soldeCentimes > 0);
}

export async function createActionRecouvrement(
  tx: Tx,
  organisationId: string,
  input: ActionRecouvrementCreate,
) {
  const contrat = await tx.contrat.findFirst({
    where: { id: input.contratId, organisationId, archiveLe: null },
  });
  if (!contrat) throw new ReferenceInvalideError("Contrat introuvable dans cet organisme.");
  return tx.actionRecouvrement.create({
    data: {
      organisationId,
      contratId: input.contratId,
      type: input.type,
      date: input.date,
      montantConcerneCentimes: input.montantConcerneCentimes ?? null,
      note: input.note ?? null,
      pieceReference: input.pieceReference ?? null,
      responsableUtilisateurId: input.responsableUtilisateurId ?? null,
    },
  });
}

export function listActionsRecouvrement(tx: Tx, organisationId: string, contratId?: string) {
  return tx.actionRecouvrement.findMany({
    where: { organisationId, ...(contratId ? { contratId } : {}) },
    orderBy: { date: "desc" },
  });
}
