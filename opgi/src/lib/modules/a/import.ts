// Import initial du référentiel patrimoine (biens, occupants) à partir d'un CSV.
// Trois garanties du brief §A/§11 : contrôle des erreurs (validation ligne à
// ligne), détection des doublons (dans le fichier ET en base), rapport d'import.
//
// S'exécute DANS une transaction `withTenant` : les lignes valides et non
// dupliquées sont insérées ensemble ; les autres sont rejetées avec leur motif.
import { bienCreateSchema, occupantCreateSchema } from "@/lib/modules/a/schemas";
import { toRecords } from "@/lib/import/csv";
import type { Tx } from "@/lib/modules/a/service";

export type RaisonRejet = "invalide" | "doublon_fichier" | "doublon_base";

export interface LigneRejetee {
  /** Numéro de ligne dans le fichier (en-tête = ligne 1). */
  ligne: number;
  cle: string | null;
  raison: RaisonRejet;
  detail: string;
}

export interface RapportImport {
  total: number;
  inseres: number;
  ignores: number;
  rejets: LigneRejetee[];
}

function premierMessage(detail: string): string {
  return detail;
}

// --- Biens (clé métier : code) ----------------------------------------------
export async function importBiens(tx: Tx, organisationId: string, csv: string): Promise<RapportImport> {
  const { records } = toRecords(csv);
  const existants = new Set(
    (await tx.bien.findMany({ where: { organisationId }, select: { code: true } })).map((b) => b.code),
  );
  const vus = new Set<string>();
  const rejets: LigneRejetee[] = [];
  const valides: { organisationId: string; code: string; type: string; etatOccupation: string; adresse: string | null }[] = [];

  records.forEach((rec, idx) => {
    const ligne = idx + 2;
    const parsed = bienCreateSchema.safeParse({
      code: rec.code,
      type: rec.type,
      etatOccupation: rec.etatoccupation || undefined,
      adresse: rec.adresse || undefined,
    });
    if (!parsed.success) {
      rejets.push({ ligne, cle: rec.code || null, raison: "invalide", detail: premierMessage(parsed.error.issues[0]?.message ?? "Ligne invalide.") });
      return;
    }
    const code = parsed.data.code;
    if (vus.has(code)) {
      rejets.push({ ligne, cle: code, raison: "doublon_fichier", detail: "Code répété dans le fichier." });
      return;
    }
    if (existants.has(code)) {
      rejets.push({ ligne, cle: code, raison: "doublon_base", detail: "Un bien avec ce code existe déjà." });
      return;
    }
    vus.add(code);
    valides.push({
      organisationId,
      code,
      type: parsed.data.type,
      etatOccupation: parsed.data.etatOccupation ?? "VACANT",
      adresse: parsed.data.adresse ?? null,
    });
  });

  if (valides.length > 0) {
    // createMany : la RLS (WITH CHECK) valide chaque ligne (organisationId).
    await tx.bien.createMany({ data: valides as never });
  }

  return { total: records.length, inseres: valides.length, ignores: rejets.length, rejets };
}

// --- Occupants (pas de clé unique : doublon = tous les champs identiques) ----
function cleOccupant(o: { type: string; nom: string; prenom: string | null; telephone: string | null; email: string | null }): string {
  return [o.type, o.nom, o.prenom ?? "", o.telephone ?? "", o.email ?? ""].join("|").toLowerCase();
}

export async function importOccupants(tx: Tx, organisationId: string, csv: string): Promise<RapportImport> {
  const { records } = toRecords(csv);
  const existants = new Set(
    (
      await tx.occupant.findMany({
        where: { organisationId },
        select: { type: true, nom: true, prenom: true, telephone: true, email: true },
      })
    ).map(cleOccupant),
  );
  const vus = new Set<string>();
  const rejets: LigneRejetee[] = [];
  const valides: {
    organisationId: string;
    type: string;
    nom: string;
    prenom: string | null;
    telephone: string | null;
    email: string | null;
  }[] = [];

  records.forEach((rec, idx) => {
    const ligne = idx + 2;
    const parsed = occupantCreateSchema.safeParse({
      type: rec.type || undefined,
      nom: rec.nom,
      prenom: rec.prenom || undefined,
      telephone: rec.telephone || undefined,
      email: rec.email || undefined,
    });
    if (!parsed.success) {
      rejets.push({ ligne, cle: rec.nom || null, raison: "invalide", detail: parsed.error.issues[0]?.message ?? "Ligne invalide." });
      return;
    }
    const occ = {
      organisationId,
      type: parsed.data.type ?? "PHYSIQUE",
      nom: parsed.data.nom,
      prenom: parsed.data.prenom ?? null,
      telephone: parsed.data.telephone ?? null,
      email: parsed.data.email ?? null,
    };
    const cle = cleOccupant(occ);
    if (vus.has(cle)) {
      rejets.push({ ligne, cle: occ.nom, raison: "doublon_fichier", detail: "Occupant identique répété dans le fichier." });
      return;
    }
    if (existants.has(cle)) {
      rejets.push({ ligne, cle: occ.nom, raison: "doublon_base", detail: "Un occupant identique existe déjà." });
      return;
    }
    vus.add(cle);
    valides.push(occ);
  });

  if (valides.length > 0) {
    await tx.occupant.createMany({ data: valides as never });
  }

  return { total: records.length, inseres: valides.length, ignores: rejets.length, rejets };
}
