import { describe, it, expect } from "vitest";
import { can, assertCan, AuthorizationError } from "@/lib/authz/permissions.js";

describe("matrice d'autorisation (moindre privilège)", () => {
  it("ADMIN_OPGI gère les trois modules", () => {
    for (const m of ["A", "B", "C"] as const) {
      expect(can("ADMIN_OPGI", m, "modifier")).toBe(true);
    }
  });

  it("ADMIN_PLATEFORME n'a AUCUN droit métier (séparation technique ↔ métier)", () => {
    for (const m of ["A", "B", "C"] as const) {
      for (const a of ["lire", "creer", "modifier", "valider", "exporter"] as const) {
        expect(can("ADMIN_PLATEFORME", m, a)).toBe(false);
      }
    }
  });

  it("AGENT_LOCATIF gère A mais ne valide pas, et ne crée pas sur C", () => {
    expect(can("AGENT_LOCATIF", "A", "creer")).toBe(true);
    expect(can("AGENT_LOCATIF", "A", "valider")).toBe(false);
    expect(can("AGENT_LOCATIF", "C", "lire")).toBe(true);
    expect(can("AGENT_LOCATIF", "C", "creer")).toBe(false);
    expect(can("AGENT_LOCATIF", "B", "lire")).toBe(false);
  });

  it("GESTIONNAIRE_MARCHES valide les situations (module B)", () => {
    expect(can("GESTIONNAIRE_MARCHES", "B", "valider")).toBe(true);
    expect(can("GESTIONNAIRE_MARCHES", "A", "lire")).toBe(false);
  });

  it("OCCUPANT limité à déposer/consulter ses réclamations (C)", () => {
    expect(can("OCCUPANT", "C", "creer")).toBe(true);
    expect(can("OCCUPANT", "C", "valider")).toBe(false);
    expect(can("OCCUPANT", "A", "lire")).toBe(false);
  });

  it("AUDITEUR en lecture seule partout", () => {
    expect(can("AUDITEUR", "A", "lire")).toBe(true);
    expect(can("AUDITEUR", "A", "modifier")).toBe(false);
  });

  it("assertCan lève AuthorizationError sur un refus", () => {
    expect(() => assertCan("TECHNICIEN", "A", "modifier")).toThrow(AuthorizationError);
    expect(() => assertCan("TECHNICIEN", "C", "modifier")).not.toThrow();
  });
});
