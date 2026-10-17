// Exports CSV du Module A (patrimoine, contrats, impayés). Lecture isolée par
// organisme (withTenant/RLS). Montants exposés en DZD (2 décimales, point).
import type { Tx } from "@/lib/modules/a/service";
import { listImpayes } from "@/lib/modules/a/finances";
import { toCsv } from "@/lib/export/csv";

export type TypeExport = "biens" | "contrats" | "impayes";

export interface Export {
  filename: string;
  csv: string;
}

function dzd(centimes: number | null | undefined): string {
  return centimes == null ? "" : (centimes / 100).toFixed(2);
}
function jour(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

export async function exportBiens(tx: Tx, organisationId: string): Promise<Export> {
  const biens = await tx.bien.findMany({ where: { organisationId, archiveLe: null }, orderBy: { code: "asc" } });
  const csv = toCsv(
    ["code", "type", "etatOccupation", "adresse"],
    biens.map((b) => [b.code, b.type, b.etatOccupation, b.adresse]),
  );
  return { filename: "biens.csv", csv };
}

export async function exportContrats(tx: Tx, organisationId: string): Promise<Export> {
  const contrats = await tx.contrat.findMany({
    where: { organisationId, archiveLe: null },
    orderBy: { reference: "asc" },
    include: { bien: { select: { code: true } }, occupant: { select: { nom: true } } },
  });
  const csv = toCsv(
    ["reference", "bien", "occupant", "statut", "dateDebut", "dateFin", "loyer_dzd"],
    contrats.map((c) => [c.reference, c.bien.code, c.occupant.nom, c.statut, jour(c.dateDebut), jour(c.dateFin), dzd(c.montantLoyerCentimes)]),
  );
  return { filename: "contrats.csv", csv };
}

export async function exportImpayes(tx: Tx, organisationId: string): Promise<Export> {
  const impayes = await listImpayes(tx, organisationId);
  const csv = toCsv(
    ["contrat", "bien", "occupant", "periode", "echeance", "solde_dzd", "jours_retard"],
    impayes.map((i) => [i.contratReference, i.bienCode, i.occupantNom, i.periode, jour(i.dateEcheance), dzd(i.soldeCentimes), i.joursRetard]),
  );
  return { filename: "impayes.csv", csv };
}

export function exportParType(tx: Tx, organisationId: string, type: TypeExport): Promise<Export> {
  if (type === "biens") return exportBiens(tx, organisationId);
  if (type === "contrats") return exportContrats(tx, organisationId);
  return exportImpayes(tx, organisationId);
}
