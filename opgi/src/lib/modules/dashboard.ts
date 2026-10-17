// Indicateurs des tableaux de bord — calculés à la demande (aucun chiffre figé
// ni fictif), isolés par organisme via `withTenant`. Chaque indicateur est
// accompagné d'une DÉFINITION visible (brief §11). Montants en centimes.
import type { Tx } from "@/lib/modules/a/service";
import { listImpayes } from "@/lib/modules/a/finances";
import { getMarcheDetail } from "@/lib/modules/b/service";

// --- Module A : patrimoine & locatif ----------------------------------------
export interface IndicateursPatrimoine {
  biens: { total: number; occupes: number; vacants: number; indisponibles: number; tauxOccupationPct: number };
  contratsActifs: number;
  financier: {
    duCentimes: number;
    imputeCentimes: number;
    soldeCentimes: number;
    tauxRecouvrementPct: number;
    nbImpayes: number;
  };
}

export async function indicateursPatrimoine(tx: Tx, organisationId: string): Promise<IndicateursPatrimoine> {
  const parEtat = await tx.bien.groupBy({
    by: ["etatOccupation"],
    where: { organisationId, archiveLe: null },
    _count: { _all: true },
  });
  const compteur = (etat: string) => parEtat.find((r) => r.etatOccupation === etat)?._count._all ?? 0;
  const occupes = compteur("OCCUPE");
  const vacants = compteur("VACANT");
  const indisponibles = compteur("INDISPONIBLE");
  const total = occupes + vacants + indisponibles;

  const contratsActifs = await tx.contrat.count({ where: { organisationId, statut: "ACTIF", archiveLe: null } });

  const du = (await tx.appelLoyer.aggregate({ where: { organisationId, archiveLe: null }, _sum: { montantCentimes: true } }))._sum.montantCentimes ?? 0;
  const impute = (await tx.imputation.aggregate({ where: { organisationId }, _sum: { montantCentimes: true } }))._sum.montantCentimes ?? 0;
  const impayes = await listImpayes(tx, organisationId);

  return {
    biens: {
      total,
      occupes,
      vacants,
      indisponibles,
      tauxOccupationPct: total > 0 ? Math.round((occupes / total) * 100) : 0,
    },
    contratsActifs,
    financier: {
      duCentimes: du,
      imputeCentimes: impute,
      soldeCentimes: du - impute,
      tauxRecouvrementPct: du > 0 ? Math.round((impute / du) * 100) : 0,
      nbImpayes: impayes.length,
    },
  };
}

// --- Module C : réclamations ------------------------------------------------
export interface IndicateursReclamations {
  parStatut: Record<string, number>;
  totalOuvertes: number;
  ordresParStatut: Record<string, number>;
}

const STATUTS_RECLAMATION_FERMES = new Set(["RESOLUE", "REJETEE", "DOUBLON"]);

export async function indicateursReclamations(tx: Tx, organisationId: string): Promise<IndicateursReclamations> {
  const rec = await tx.reclamation.groupBy({
    by: ["statut"],
    where: { organisationId, archiveLe: null },
    _count: { _all: true },
  });
  const parStatut: Record<string, number> = {};
  let totalOuvertes = 0;
  for (const r of rec) {
    parStatut[r.statut] = r._count._all;
    if (!STATUTS_RECLAMATION_FERMES.has(r.statut)) totalOuvertes += r._count._all;
  }

  const ot = await tx.ordreTravail.groupBy({
    by: ["statut"],
    where: { organisationId, archiveLe: null },
    _count: { _all: true },
  });
  const ordresParStatut: Record<string, number> = {};
  for (const r of ot) ordresParStatut[r.statut] = r._count._all;

  return { parStatut, totalOuvertes, ordresParStatut };
}

// --- Module B : projets, marchés --------------------------------------------
export interface IndicateursProjets {
  projetsTotal: number;
  projetsParStatut: Record<string, number>;
  marchesTotal: number;
  montantEngageCentimes: number;
  montantConstateCentimes: number;
  avancementFinancierPct: number;
  nbDepassement: number;
  nbRetard: number;
}

export async function indicateursProjets(tx: Tx, organisationId: string): Promise<IndicateursProjets> {
  const projets = await tx.projet.groupBy({
    by: ["statut"],
    where: { organisationId, archiveLe: null },
    _count: { _all: true },
  });
  const projetsParStatut: Record<string, number> = {};
  let projetsTotal = 0;
  for (const r of projets) {
    projetsParStatut[r.statut] = r._count._all;
    projetsTotal += r._count._all;
  }

  const marches = await tx.marche.findMany({ where: { organisationId, archiveLe: null }, select: { id: true } });
  let montantEngage = 0;
  let montantConstate = 0;
  let nbDepassement = 0;
  let nbRetard = 0;
  for (const m of marches) {
    const d = await getMarcheDetail(tx, organisationId, m.id);
    if (!d) continue;
    montantEngage += d.montantEngageCentimes;
    montantConstate += d.montantConstateValideCentimes;
    if (d.depassement) nbDepassement++;
    if (d.retard) nbRetard++;
  }

  return {
    projetsTotal,
    projetsParStatut,
    marchesTotal: marches.length,
    montantEngageCentimes: montantEngage,
    montantConstateCentimes: montantConstate,
    avancementFinancierPct: montantEngage > 0 ? Math.round((montantConstate / montantEngage) * 100) : 0,
    nbDepassement,
    nbRetard,
  };
}
