// Tests d'intégration des indicateurs de tableau de bord. Un organisme dédié
// « OPGI-DASH » est ensemencé avec un scénario contrôlé (via le rôle
// propriétaire), puis les indicateurs sont calculés via le rôle applicatif
// (withTenant) et comparés à des valeurs exactes.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createAppClient, withTenant } from "@/lib/tenant/prisma";
import {
  indicateursPatrimoine,
  indicateursReclamations,
  indicateursProjets,
} from "@/lib/modules/dashboard";
import type { TenantContext } from "@/lib/tenant/context";
import { loadEnv, requireEnv } from "./_env.js";

loadEnv();

let app: PrismaClient;
let owner: PrismaClient;
let ctx: TenantContext;

beforeAll(async () => {
  app = createAppClient(requireEnv("TEST_DATABASE_URL"));
  owner = new PrismaClient({ datasources: { db: { url: requireEnv("TEST_DIRECT_DATABASE_URL") } } });

  await owner.organisation.deleteMany({ where: { code: "OPGI-DASH" } });
  const org = await owner.organisation.create({ data: { code: "OPGI-DASH", nom: "Dash (DÉMO)", modules: ["A", "B", "C"] } });
  ctx = { organisationId: org.id, mode: "shared" };
  const o = org.id;

  // --- Patrimoine : 3 occupés, 1 vacant, 1 indisponible (taux occ = 60 %).
  await owner.bien.createMany({
    data: [
      { organisationId: o, code: "D-1", type: "LOGEMENT", etatOccupation: "OCCUPE" },
      { organisationId: o, code: "D-2", type: "LOGEMENT", etatOccupation: "OCCUPE" },
      { organisationId: o, code: "D-3", type: "LOGEMENT", etatOccupation: "OCCUPE" },
      { organisationId: o, code: "D-4", type: "GARAGE", etatOccupation: "VACANT" },
      { organisationId: o, code: "D-5", type: "AUTRE", etatOccupation: "INDISPONIBLE" },
    ],
  });
  const bien = await owner.bien.findFirstOrThrow({ where: { organisationId: o, code: "D-1" } });
  const occupant = await owner.occupant.create({ data: { organisationId: o, nom: "Dash" } });
  const contrat = await owner.contrat.create({
    data: { organisationId: o, reference: "D-CT", bienId: bien.id, occupantId: occupant.id, statut: "ACTIF", dateDebut: new Date("2026-01-01") },
  });
  // Dû = 200000 ; imputé = 60000 ; solde = 140000 ; taux recouvrement = 30 % ; 2 impayés.
  const a1 = await owner.appelLoyer.create({ data: { organisationId: o, contratId: contrat.id, periode: "2026-01", montantCentimes: 100000, dateEcheance: new Date("2026-01-05") } });
  await owner.appelLoyer.create({ data: { organisationId: o, contratId: contrat.id, periode: "2026-02", montantCentimes: 100000, dateEcheance: new Date("2026-02-05") } });
  const p = await owner.paiement.create({ data: { organisationId: o, contratId: contrat.id, montantCentimes: 60000, datePaiement: new Date("2026-01-10") } });
  await owner.imputation.create({ data: { organisationId: o, paiementId: p.id, appelId: a1.id, montantCentimes: 60000 } });

  // --- Réclamations : 1 ouverte (NOUVELLE), 1 fermée (RESOLUE) ; 1 OT OUVERT.
  const rec = await owner.reclamation.create({ data: { organisationId: o, reference: "D-R1", categorie: "PLOMBERIE", description: "x", statut: "NOUVELLE" } });
  await owner.reclamation.create({ data: { organisationId: o, reference: "D-R2", categorie: "AUTRE", description: "y", statut: "RESOLUE" } });
  await owner.ordreTravail.create({ data: { organisationId: o, reclamationId: rec.id, reference: "D-OT1", statut: "OUVERT" } });

  // --- Projets/marchés : 2 projets ; 2 marchés (engagé 1000000 chacun).
  const proj = await owner.projet.create({ data: { organisationId: o, code: "D-P1", intitule: "P1", statut: "EN_COURS" } });
  await owner.projet.create({ data: { organisationId: o, code: "D-P2", intitule: "P2", statut: "EN_PREPARATION" } });
  const ent = await owner.entreprise.create({ data: { organisationId: o, raisonSociale: "Dash BTP" } });
  // Marché 1 : constaté 500000 (avancement 50 %), en retard (délai dépassé).
  const m1 = await owner.marche.create({ data: { organisationId: o, reference: "D-M1", projetId: proj.id, entrepriseId: ent.id, objet: "o", montantCentimes: 1000000, statut: "EN_COURS", dateNotification: new Date("2020-01-01"), delaiJours: 1 } });
  await owner.situationTravaux.create({ data: { organisationId: o, marcheId: m1.id, numero: 1, montantTravauxCentimes: 500000, statut: "VALIDEE", dateDepot: new Date("2026-01-01") } });
  // Marché 2 : constaté 1500000 > engagé 1000000 (dépassement).
  const m2 = await owner.marche.create({ data: { organisationId: o, reference: "D-M2", projetId: proj.id, entrepriseId: ent.id, objet: "o", montantCentimes: 1000000, statut: "EN_COURS" } });
  await owner.situationTravaux.create({ data: { organisationId: o, marcheId: m2.id, numero: 1, montantTravauxCentimes: 1500000, statut: "VALIDEE", dateDepot: new Date("2026-01-01") } });
}, 30000);

afterAll(async () => {
  await owner.organisation.deleteMany({ where: { code: "OPGI-DASH" } });
  await app.$disconnect();
  await owner.$disconnect();
});

describe("indicateurs patrimoine & locatif", () => {
  it("compte les biens par état et le taux d'occupation", async () => {
    const i = await withTenant(app, ctx, (tx) => indicateursPatrimoine(tx, ctx.organisationId));
    expect(i.biens).toMatchObject({ total: 5, occupes: 3, vacants: 1, indisponibles: 1, tauxOccupationPct: 60 });
    expect(i.contratsActifs).toBe(1);
  });

  it("calcule dû / imputé / solde / taux de recouvrement / impayés", async () => {
    const i = await withTenant(app, ctx, (tx) => indicateursPatrimoine(tx, ctx.organisationId));
    expect(i.financier).toMatchObject({
      duCentimes: 200000,
      imputeCentimes: 60000,
      soldeCentimes: 140000,
      tauxRecouvrementPct: 30,
      nbImpayes: 2,
    });
  });
});

describe("indicateurs réclamations", () => {
  it("répartit par statut et compte les réclamations ouvertes", async () => {
    const i = await withTenant(app, ctx, (tx) => indicateursReclamations(tx, ctx.organisationId));
    expect(i.parStatut.NOUVELLE).toBe(1);
    expect(i.parStatut.RESOLUE).toBe(1);
    expect(i.totalOuvertes).toBe(1);
    expect(i.ordresParStatut.OUVERT).toBe(1);
  });
});

describe("indicateurs projets & marchés", () => {
  it("agrège engagé/constaté, l'avancement et les alertes", async () => {
    const i = await withTenant(app, ctx, (tx) => indicateursProjets(tx, ctx.organisationId));
    expect(i.projetsTotal).toBe(2);
    expect(i.marchesTotal).toBe(2);
    expect(i.montantEngageCentimes).toBe(2000000);
    expect(i.montantConstateCentimes).toBe(2000000); // 500000 + 1500000
    expect(i.avancementFinancierPct).toBe(100);
    expect(i.nbDepassement).toBe(1); // marché 2
    expect(i.nbRetard).toBe(1); // marché 1
  });
});
