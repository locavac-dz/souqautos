import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getLoadDatabaseUrl } from "../scripts/load-database";
import { computeEstimateFromPrices, estimateFromIndex, indexComparables, type EstimateResult } from "@/lib/price-estimation";

// Lot 140 — l'estimation « rangée par année » rend EXACTEMENT ce que rendait l'ancienne (parcours complet des annonces du modèle).
// Le calcul n'a pas changé de règles, seulement de chemin d'accès : ce test le PROUVE au lieu de l'affirmer, en comparant les deux
// sur des annonces réelles de la base de charge (jusqu'à 100 000 annonces, `npm run load:seed`). Se SAUTE si cette base est absente.
//
// La référence ci-dessous est la copie CONFORME de l'algorithme d'avant ce lot (extrait du dépôt, commit du Lot 139) : recopie du
// tableau pour l'exclusion, un `filter` complet par palier, et le test d'équipement par Set. Elle ne doit jamais être « améliorée » :
// c'est son immobilité qui fait la valeur de la comparaison.

type Row = { id: string; price: number; year: number; mileage: number; wilayaId: number; equipmentIds?: number[] };
type Query = { year?: number; mileage?: number; wilayaId?: number; equipmentIds?: number[]; excludeListingId?: string };
type Tier = { year: boolean; mileage: boolean; wilaya: boolean; equipment: boolean };

const YEAR_WINDOW = 2;
const MILEAGE_BAND_RATIO = 0.3;
const EQUIPMENT_OVERLAP_RATIO = 0.5;

function buildTiers(query: Query): Tier[] {
  const hasEquipment = Boolean(query.equipmentIds && query.equipmentIds.length > 0);
  const tiers: Tier[] = [
    { year: Boolean(query.year), mileage: Boolean(query.mileage), wilaya: Boolean(query.wilayaId), equipment: hasEquipment },
    { year: Boolean(query.year), mileage: Boolean(query.mileage), wilaya: Boolean(query.wilayaId), equipment: false },
    { year: Boolean(query.year), mileage: Boolean(query.mileage), wilaya: false, equipment: false },
    { year: Boolean(query.year), mileage: false, wilaya: false, equipment: false },
    { year: false, mileage: false, wilaya: false, equipment: false },
  ];
  const seen = new Set<string>();
  return tiers.filter((t) => {
    const key = `${t.year}-${t.mileage}-${t.wilaya}-${t.equipment}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function matchesEquipment(rowEquipmentIds: number[], queryEquipmentIds: number[]): boolean {
  if (queryEquipmentIds.length === 0) return true;
  const rowSet = new Set(rowEquipmentIds);
  const sharedCount = queryEquipmentIds.filter((id) => rowSet.has(id)).length;
  return sharedCount / queryEquipmentIds.length >= EQUIPMENT_OVERLAP_RATIO;
}

function matchesTier(row: Row, query: Query, tier: Tier): boolean {
  if (tier.year && query.year !== undefined) {
    if (row.year < query.year - YEAR_WINDOW || row.year > query.year + YEAR_WINDOW) return false;
  }
  if (tier.mileage && query.mileage !== undefined) {
    const lo = query.mileage * (1 - MILEAGE_BAND_RATIO);
    const hi = query.mileage * (1 + MILEAGE_BAND_RATIO);
    if (row.mileage < lo || row.mileage > hi) return false;
  }
  if (tier.wilaya && query.wilayaId !== undefined && row.wilayaId !== query.wilayaId) return false;
  if (tier.equipment && !matchesEquipment(row.equipmentIds ?? [], query.equipmentIds ?? [])) return false;
  return true;
}

// L'ANCIENNE fonction, mot pour mot.
function referenceEstimate(rows: Row[], query: Query): EstimateResult | null {
  const candidates = query.excludeListingId ? rows.filter((r) => r.id !== query.excludeListingId) : rows;
  for (const tier of buildTiers(query)) {
    const matched = candidates.filter((r) => matchesTier(r, query, tier));
    if (matched.length > 0) {
      const base = computeEstimateFromPrices(matched.map((r) => r.price));
      if (!base) continue;
      return { ...base, appliedFilters: tier };
    }
  }
  return null;
}

let prisma: PrismaClient | null = null;
let ready = false;
type Card = { id: string; brandId: number | null; modelId: number | null; year: number; mileage: number; wilayaId: number; price: number; equipmentIds: number[] };
const cards: Card[] = [];
const rowsByPair = new Map<string, Row[]>();

beforeAll(async () => {
  try {
    prisma = new PrismaClient({ datasourceUrl: getLoadDatabaseUrl() });
    ready = (await prisma.listing.count({ where: { status: "PUBLIEE" } })) >= 1000;
    if (!ready) return;
    // Un échantillon LARGE et varié : les plus récentes, les moins chères, les plus chères, les plus anciennes, les plus
    // kilométrées — pour toucher des modèles courants comme rares, et des paliers différents.
    const picks = await Promise.all(
      ([
        { createdAt: "desc" },
        { price: "asc" },
        { price: "desc" },
        { year: "asc" },
        { mileage: "desc" },
      ] as const).map((orderBy) =>
        prisma!.listing.findMany({ where: { status: "PUBLIEE" }, orderBy, take: 80, select: { id: true, brandId: true, modelId: true, year: true, mileage: true, wilayaId: true, price: true, equipments: { select: { equipmentId: true } } } }),
      ),
    );
    const seen = new Set<string>();
    for (const listing of picks.flat()) {
      if (seen.has(listing.id) || !listing.brandId || !listing.modelId) continue;
      seen.add(listing.id);
      cards.push({ ...listing, equipmentIds: listing.equipments.map((e) => e.equipmentId) });
    }
    for (const card of cards) {
      const key = `${card.brandId}-${card.modelId}`;
      if (rowsByPair.has(key)) continue;
      const rows = await prisma.listing.findMany({ where: { status: "PUBLIEE", brandId: card.brandId, modelId: card.modelId }, select: { id: true, price: true, year: true, mileage: true, wilayaId: true, equipments: { select: { equipmentId: true } } } });
      rowsByPair.set(key, rows.map(({ equipments, ...r }) => ({ ...r, equipmentIds: equipments.map((e) => e.equipmentId) })));
    }
  } catch {
    ready = false;
  }
}, 180_000);

afterAll(async () => {
  await prisma?.$disconnect();
});

const queryOf = (card: Card): Query => ({ year: card.year, mileage: card.mileage, wilayaId: card.wilayaId, equipmentIds: card.equipmentIds, excludeListingId: card.id });

describe("estimation de prix : le rangement par année ne change AUCUN résultat", () => {
  it("l'échantillon est assez large et varié pour que la comparaison ait du sens", () => {
    if (!ready) return;
    expect(cards.length).toBeGreaterThan(200);
    expect(rowsByPair.size).toBeGreaterThan(10);
    const sizes = [...rowsByPair.values()].map((r) => r.length);
    expect(Math.max(...sizes)).toBeGreaterThan(1000); // un modèle très courant
    expect(Math.min(...sizes)).toBeLessThan(200); // et un modèle rare
    const years = new Set(cards.map((c) => c.year));
    expect(years.size).toBeGreaterThan(10);
  });

  it("chaque annonce de l'échantillon obtient exactement la même estimation qu'avant (valeurs ET critères retenus)", () => {
    if (!ready) return;
    const differences: string[] = [];
    const tiersUsed = new Map<string, number>();
    for (const card of cards) {
      const rows = rowsByPair.get(`${card.brandId}-${card.modelId}`)!;
      const query = queryOf(card);
      const before = referenceEstimate(rows, query);
      const after = estimateFromIndex(indexComparables(rows), query);
      if (JSON.stringify(before) !== JSON.stringify(after)) differences.push(`${card.id} : avant ${JSON.stringify(before)} / après ${JSON.stringify(after)}`);
      const key = before ? Object.entries(before.appliedFilters).filter(([, v]) => v).map(([k]) => k).join("+") || "(aucun critère)" : "(aucune estimation)";
      tiersUsed.set(key, (tiersUsed.get(key) ?? 0) + 1);
    }
    expect(differences).toEqual([]);
    // Le corpus doit vraiment exercer plusieurs paliers, sinon la comparaison ne prouverait qu'un seul chemin.
    expect(tiersUsed.size).toBeGreaterThan(2);
  }, 120_000);

  it("et aussi pour des demandes SANS exclusion, et avec des critères partiels (page de cote)", () => {
    if (!ready) return;
    const differences: string[] = [];
    for (const card of cards.slice(0, 120)) {
      const rows = rowsByPair.get(`${card.brandId}-${card.modelId}`)!;
      const variants: Query[] = [
        { year: card.year, mileage: card.mileage, wilayaId: card.wilayaId, equipmentIds: card.equipmentIds }, // cote complète
        { year: card.year, mileage: card.mileage }, // sans wilaya ni équipement
        { year: card.year }, // année seule
        { mileage: card.mileage, wilayaId: card.wilayaId }, // sans année : le rangement par année ne doit pas servir
        {}, // aucun critère : tout le modèle
        { year: card.year + 40 }, // aucune annonce de cette année : le repli doit être identique
        { year: card.year, mileage: 0 }, // kilométrage nul (Boolean(0) === false : palier sans kilométrage)
      ];
      for (const [index, query] of variants.entries()) {
        const before = referenceEstimate(rows, query);
        const after = estimateFromIndex(indexComparables(rows), query);
        if (JSON.stringify(before) !== JSON.stringify(after)) differences.push(`${card.id} variante ${index} : avant ${JSON.stringify(before)} / après ${JSON.stringify(after)}`);
      }
    }
    expect(differences).toEqual([]);
  }, 120_000);

  it("une année non entière élargit la fenêtre exactement pareil (bornes du rangement par année)", () => {
    if (!ready) return;
    const differences: string[] = [];
    for (const card of cards.slice(0, 60)) {
      const rows = rowsByPair.get(`${card.brandId}-${card.modelId}`)!;
      for (const year of [card.year - 0.5, card.year + 0.5, card.year + 1.9, card.year - 2.1]) {
        const query: Query = { year, mileage: card.mileage };
        const before = referenceEstimate(rows, query);
        const after = estimateFromIndex(indexComparables(rows), query);
        if (JSON.stringify(before) !== JSON.stringify(after)) differences.push(`${card.id} année ${year} : avant ${JSON.stringify(before)} / après ${JSON.stringify(after)}`);
      }
    }
    expect(differences).toEqual([]);
  }, 120_000);
});
