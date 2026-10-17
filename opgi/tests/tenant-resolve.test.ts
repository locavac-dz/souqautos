import { describe, it, expect } from "vitest";
import { resolveTenant } from "@/lib/tenant/resolve.js";
import {
  loadIsolationConfig,
  TenantResolutionError,
  type VerifiedSession,
} from "@/lib/tenant/context.js";

const session: VerifiedSession = {
  utilisateurId: "u1",
  organisationId: "org-alger",
  role: "AGENT_LOCATIF",
};

describe("resolveTenant — l'organisme vient de la session, jamais du client (D3)", () => {
  const shared = { mode: "shared" as const };

  it("mode partagé : renvoie l'organisme de la session", () => {
    expect(resolveTenant(session, shared).organisationId).toBe("org-alger");
  });

  it("ignore un indice client identique à la session", () => {
    expect(resolveTenant(session, shared, "org-alger").organisationId).toBe("org-alger");
  });

  it("REFUSE un indice client qui tente un autre organisme (accès croisé)", () => {
    expect(() => resolveTenant(session, shared, "org-oran")).toThrow(TenantResolutionError);
  });

  it("refuse une session sans organisme", () => {
    const bad = { ...session, organisationId: "" };
    expect(() => resolveTenant(bad, shared)).toThrow(TenantResolutionError);
  });

  describe("mode dédié (installation chez l'OPGI)", () => {
    const dedicated = { mode: "dedicated" as const, organisationId: "org-alger" };

    it("accepte une session du bon organisme", () => {
      expect(resolveTenant(session, dedicated).organisationId).toBe("org-alger");
    });

    it("REFUSE une session d'un autre organisme sur une instance dédiée", () => {
      const autre = { ...session, organisationId: "org-oran" };
      expect(() => resolveTenant(autre, dedicated)).toThrow(TenantResolutionError);
    });
  });
});

describe("loadIsolationConfig", () => {
  it("défaut = mode partagé", () => {
    expect(loadIsolationConfig({}).mode).toBe("shared");
  });

  it("mode dédié exige ORGANISATION_ID", () => {
    expect(() => loadIsolationConfig({ ISOLATION_MODE: "dedicated" })).toThrow();
    expect(loadIsolationConfig({ ISOLATION_MODE: "dedicated", ORGANISATION_ID: "x" })).toEqual({
      mode: "dedicated",
      organisationId: "x",
    });
  });
});
