// Services du Module A. Chaque fonction s'exécute DANS une transaction
// `withTenant` (le `tx` est déjà cloisonné par `app.org_id` + RLS). Les liens
// entre entités (contrat → bien/occupant) sont vérifiés DANS le tenant : une
// clé étrangère seule ne suffit pas, car la vérification FK de PostgreSQL
// contourne la RLS et pourrait sinon pointer vers un bien d'un autre organisme.
import type { Prisma } from "@prisma/client";
import type {
  BienCreate,
  BienUpdate,
  OccupantCreate,
  OccupantUpdate,
  ContratCreate,
  ContratUpdate,
  SiteCreate,
  SiteUpdate,
} from "@/lib/modules/a/schemas";

export type Tx = Prisma.TransactionClient;

/** Erreur de lien invalide (référence vers une entité absente du tenant). */
export class ReferenceInvalideError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReferenceInvalideError";
  }
}

/** Erreur de règle métier d'intégrité (ex. imputation dépassant le dû). */
export class RegleMetierError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RegleMetierError";
  }
}

// --- Bien -------------------------------------------------------------------

export interface ListeOpts {
  inclureArchives?: boolean;
  q?: string;
  skip?: number;
  take?: number;
}

function whereBiens(organisationId: string, o: ListeOpts) {
  return {
    organisationId,
    ...(o.inclureArchives ? {} : { archiveLe: null }),
    ...(o.q
      ? {
          OR: [
            { code: { contains: o.q, mode: "insensitive" as const } },
            { adresse: { contains: o.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
}

export function listBiens(tx: Tx, organisationId: string, o: ListeOpts = {}) {
  return tx.bien.findMany({
    where: whereBiens(organisationId, o),
    orderBy: { code: "asc" },
    skip: o.skip,
    take: o.take,
  });
}

export function countBiens(tx: Tx, organisationId: string, o: ListeOpts = {}) {
  return tx.bien.count({ where: whereBiens(organisationId, o) });
}

export function getBien(tx: Tx, organisationId: string, id: string) {
  return tx.bien.findFirst({ where: { id, organisationId } });
}

/** Vérifie qu'un site appartient bien à l'organisme (sinon référence invalide). */
async function assertSiteDuTenant(tx: Tx, organisationId: string, siteId: string) {
  const site = await tx.site.findFirst({ where: { id: siteId, organisationId, archiveLe: null } });
  if (!site) throw new ReferenceInvalideError("Site introuvable dans cet organisme.");
}

export async function createBien(tx: Tx, organisationId: string, input: BienCreate) {
  if (input.siteId) await assertSiteDuTenant(tx, organisationId, input.siteId);
  return tx.bien.create({
    data: {
      organisationId,
      code: input.code,
      type: input.type,
      etatOccupation: input.etatOccupation ?? "VACANT",
      adresse: input.adresse ?? null,
      siteId: input.siteId ?? null,
    },
  });
}

export async function updateBien(tx: Tx, organisationId: string, id: string, input: BienUpdate) {
  if (input.siteId) await assertSiteDuTenant(tx, organisationId, input.siteId);
  // updateMany applique le filtre organisationId (une mise à jour ciblée par id
  // seul pourrait, sans RLS, toucher une autre ligne). Renvoie null si absent.
  const res = await tx.bien.updateMany({ where: { id, organisationId }, data: input });
  if (res.count === 0) return null;
  return getBien(tx, organisationId, id);
}

// --- Site (hiérarchie du patrimoine) ---------------------------------------

function whereSites(organisationId: string, o: ListeOpts) {
  return {
    organisationId,
    ...(o.inclureArchives ? {} : { archiveLe: null }),
    ...(o.q
      ? {
          OR: [
            { code: { contains: o.q, mode: "insensitive" as const } },
            { nom: { contains: o.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
}
export function listSites(tx: Tx, organisationId: string, o: ListeOpts = {}) {
  return tx.site.findMany({
    where: whereSites(organisationId, o),
    orderBy: { code: "asc" },
    skip: o.skip,
    take: o.take,
  });
}
export function countSites(tx: Tx, organisationId: string, o: ListeOpts = {}) {
  return tx.site.count({ where: whereSites(organisationId, o) });
}
export function getSite(tx: Tx, organisationId: string, id: string) {
  return tx.site.findFirst({ where: { id, organisationId } });
}
export function createSite(tx: Tx, organisationId: string, input: SiteCreate) {
  return tx.site.create({
    data: { organisationId, code: input.code, nom: input.nom, adresse: input.adresse ?? null },
  });
}
export async function updateSite(tx: Tx, organisationId: string, id: string, input: SiteUpdate) {
  const res = await tx.site.updateMany({ where: { id, organisationId }, data: input });
  if (res.count === 0) return null;
  return getSite(tx, organisationId, id);
}
export async function archiveSite(tx: Tx, organisationId: string, id: string) {
  const res = await tx.site.updateMany({
    where: { id, organisationId, archiveLe: null },
    data: { archiveLe: new Date() },
  });
  return res.count > 0;
}

export async function archiveBien(tx: Tx, organisationId: string, id: string) {
  const res = await tx.bien.updateMany({
    where: { id, organisationId, archiveLe: null },
    data: { archiveLe: new Date() },
  });
  return res.count > 0;
}

// --- Occupant ---------------------------------------------------------------

function whereOccupants(organisationId: string, o: ListeOpts) {
  return {
    organisationId,
    ...(o.inclureArchives ? {} : { archiveLe: null }),
    ...(o.q
      ? {
          OR: [
            { nom: { contains: o.q, mode: "insensitive" as const } },
            { prenom: { contains: o.q, mode: "insensitive" as const } },
            { email: { contains: o.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
}

export function listOccupants(tx: Tx, organisationId: string, o: ListeOpts = {}) {
  return tx.occupant.findMany({
    where: whereOccupants(organisationId, o),
    orderBy: { nom: "asc" },
    skip: o.skip,
    take: o.take,
  });
}

export function countOccupants(tx: Tx, organisationId: string, o: ListeOpts = {}) {
  return tx.occupant.count({ where: whereOccupants(organisationId, o) });
}

export function getOccupant(tx: Tx, organisationId: string, id: string) {
  return tx.occupant.findFirst({ where: { id, organisationId } });
}

export function createOccupant(tx: Tx, organisationId: string, input: OccupantCreate) {
  return tx.occupant.create({
    data: {
      organisationId,
      type: input.type ?? "PHYSIQUE",
      nom: input.nom,
      prenom: input.prenom ?? null,
      telephone: input.telephone ?? null,
      email: input.email ?? null,
    },
  });
}

export async function updateOccupant(
  tx: Tx,
  organisationId: string,
  id: string,
  input: OccupantUpdate,
) {
  const res = await tx.occupant.updateMany({ where: { id, organisationId }, data: input });
  if (res.count === 0) return null;
  return getOccupant(tx, organisationId, id);
}

export async function archiveOccupant(tx: Tx, organisationId: string, id: string) {
  const res = await tx.occupant.updateMany({
    where: { id, organisationId, archiveLe: null },
    data: { archiveLe: new Date() },
  });
  return res.count > 0;
}

// --- Contrat ----------------------------------------------------------------

function whereContrats(organisationId: string, o: ListeOpts) {
  return {
    organisationId,
    ...(o.inclureArchives ? {} : { archiveLe: null }),
    ...(o.q ? { reference: { contains: o.q, mode: "insensitive" as const } } : {}),
  };
}

export function listContrats(tx: Tx, organisationId: string, o: ListeOpts = {}) {
  return tx.contrat.findMany({
    where: whereContrats(organisationId, o),
    orderBy: { reference: "asc" },
    skip: o.skip,
    take: o.take,
  });
}

export function countContrats(tx: Tx, organisationId: string, o: ListeOpts = {}) {
  return tx.contrat.count({ where: whereContrats(organisationId, o) });
}

export function getContrat(tx: Tx, organisationId: string, id: string) {
  return tx.contrat.findFirst({ where: { id, organisationId } });
}

async function assertBienEtOccupantDuTenant(
  tx: Tx,
  organisationId: string,
  bienId: string,
  occupantId: string,
) {
  const bien = await tx.bien.findFirst({ where: { id: bienId, organisationId, archiveLe: null } });
  if (!bien) throw new ReferenceInvalideError("Bien introuvable dans cet organisme.");
  const occupant = await tx.occupant.findFirst({
    where: { id: occupantId, organisationId, archiveLe: null },
  });
  if (!occupant) throw new ReferenceInvalideError("Occupant introuvable dans cet organisme.");
}

export async function createContrat(tx: Tx, organisationId: string, input: ContratCreate) {
  await assertBienEtOccupantDuTenant(tx, organisationId, input.bienId, input.occupantId);
  return tx.contrat.create({
    data: {
      organisationId,
      reference: input.reference,
      bienId: input.bienId,
      occupantId: input.occupantId,
      statut: input.statut ?? "BROUILLON",
      dateDebut: input.dateDebut,
      dateFin: input.dateFin ?? null,
      montantLoyerCentimes: input.montantLoyerCentimes ?? null,
    },
  });
}

export async function updateContrat(
  tx: Tx,
  organisationId: string,
  id: string,
  input: ContratUpdate,
) {
  const res = await tx.contrat.updateMany({ where: { id, organisationId }, data: input });
  if (res.count === 0) return null;
  return getContrat(tx, organisationId, id);
}

export async function archiveContrat(tx: Tx, organisationId: string, id: string) {
  const res = await tx.contrat.updateMany({
    where: { id, organisationId, archiveLe: null },
    data: { archiveLe: new Date() },
  });
  return res.count > 0;
}
