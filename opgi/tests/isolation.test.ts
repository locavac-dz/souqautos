// Tests d'ISOLATION inter‑organisme contre une vraie base PostgreSQL.
//
// Le client applicatif se connecte avec le rôle restreint `opgi_app`, SOUMIS à
// la Row-Level Security. On démontre qu'un organisme ne peut jamais voir ni
// écrire les données d'un autre — y compris quand le filtre applicatif est
// absent (c'est alors la RLS qui ferme l'accès).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createAppClient, withTenant } from "@/lib/tenant/prisma.js";
import { loadEnv, requireEnv } from "./_env.js";

loadEnv();

let app: PrismaClient; // rôle restreint opgi_app (soumis RLS)
let owner: PrismaClient; // rôle propriétaire (pour lire les deux organismes)
let algerId: string;
let oranId: string;

beforeAll(async () => {
  app = createAppClient(requireEnv("TEST_DATABASE_URL"));
  owner = new PrismaClient({ datasources: { db: { url: requireEnv("TEST_DIRECT_DATABASE_URL") } } });
  const orgs = await owner.organisation.findMany({ orderBy: { code: "asc" } });
  algerId = orgs.find((o) => o.code === "OPGI-ALGER")!.id;
  oranId = orgs.find((o) => o.code === "OPGI-ORAN")!.id;
});

afterAll(async () => {
  await app.$disconnect();
  await owner.$disconnect();
});

describe("isolation des données métier via RLS", () => {
  it("un organisme ne voit QUE ses propres biens", async () => {
    const biensAlger = await withTenant(app, { organisationId: algerId, mode: "shared" }, (tx) =>
      tx.bien.findMany(),
    );
    expect(biensAlger.length).toBeGreaterThan(0);
    expect(biensAlger.every((b) => b.organisationId === algerId)).toBe(true);

    const biensOran = await withTenant(app, { organisationId: oranId, mode: "shared" }, (tx) =>
      tx.bien.findMany(),
    );
    expect(biensOran.every((b) => b.organisationId === oranId)).toBe(true);
  });

  it("accès direct à un identifiant d'un autre organisme → introuvable (jamais 200)", async () => {
    const bienOran = await withTenant(app, { organisationId: oranId, mode: "shared" }, (tx) =>
      tx.bien.findFirst(),
    );
    expect(bienOran).not.toBeNull();

    // Depuis ALGER, on tente de lire le bien d'ORAN par son id exact.
    const vol = await withTenant(app, { organisationId: algerId, mode: "shared" }, (tx) =>
      tx.bien.findUnique({ where: { id: bienOran!.id } }),
    );
    expect(vol).toBeNull();
  });

  it("la table organisation est elle aussi cloisonnée", async () => {
    const vues = await withTenant(app, { organisationId: algerId, mode: "shared" }, (tx) =>
      tx.organisation.findMany(),
    );
    expect(vues).toHaveLength(1);
    expect(vues[0]!.id).toBe(algerId);
  });

  it("FAIL CLOSED : sans organisme fixé, le rôle applicatif ne voit RIEN", async () => {
    // Requête hors `withTenant` : `app.org_id` n'est pas positionné sur la
    // connexion → la RLS ne laisse voir aucune ligne. C'est le filet qui
    // protège même si la couche applicative oublie son filtre.
    expect(await app.bien.count()).toBe(0);
    expect(await app.organisation.count()).toBe(0);
  });

  it("WITH CHECK : impossible d'ÉCRIRE pour le compte d'un autre organisme", async () => {
    await expect(
      withTenant(app, { organisationId: algerId, mode: "shared" }, (tx) =>
        tx.bien.create({
          data: { organisationId: oranId, code: "FRAUDE-001", type: "LOGEMENT" },
        }),
      ),
    ).rejects.toThrow();
  });

  it("une écriture dans son propre organisme reste possible", async () => {
    const created = await withTenant(app, { organisationId: algerId, mode: "shared" }, (tx) =>
      tx.bien.create({
        data: { organisationId: algerId, code: "ALG-TEST-WRITE", type: "AUTRE" },
      }),
    );
    expect(created.organisationId).toBe(algerId);
    // nettoyage
    await withTenant(app, { organisationId: algerId, mode: "shared" }, (tx) =>
      tx.bien.delete({ where: { id: created.id } }),
    );
  });
});
