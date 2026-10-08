import { describe, expect, it, vi } from "vitest";

// getCurrentUser dépend de la session et de la base : simulées ici, pour prouver le comportement du POINT UNIQUE où le rôle
// effectif est appliqué.
const { getSessionFromCookies, findUnique } = vi.hoisted(() => ({ getSessionFromCookies: vi.fn(), findUnique: vi.fn() }));
vi.mock("@/lib/auth-server/session", () => ({ getSessionFromCookies: (...a: unknown[]) => getSessionFromCookies(...a) }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: (...a: unknown[]) => findUnique(...a) } } }));

import { getCurrentUser } from "@/lib/auth-server/current-user";
import { effectiveRole, isStaffRole, staffTwoFactorRequired } from "@/lib/staff-two-factor";
import { isAdmin, isStaff } from "@/lib/auth-server/roles";

describe("staffTwoFactorRequired — exigée en production, réglable", () => {
  it("par défaut : oui en production, non ailleurs (les tests et le développement gardent des comptes d'équipe simples)", () => {
    expect(staffTwoFactorRequired({ NODE_ENV: "production" })).toBe(true);
    expect(staffTwoFactorRequired({ NODE_ENV: "development" })).toBe(false);
    expect(staffTwoFactorRequired({ NODE_ENV: "test" })).toBe(false);
    expect(staffTwoFactorRequired({})).toBe(false);
  });
  it("REQUIRE_STAFF_2FA force dans les deux sens", () => {
    expect(staffTwoFactorRequired({ NODE_ENV: "development", REQUIRE_STAFF_2FA: "1" })).toBe(true);
    expect(staffTwoFactorRequired({ NODE_ENV: "production", REQUIRE_STAFF_2FA: "0" })).toBe(false);
  });
  it("toute autre valeur est ignorée (jamais « désactivé par une faute de frappe »)", () => {
    for (const value of ["", "true", "non", "off", " 0", "2"]) expect(staffTwoFactorRequired({ NODE_ENV: "production", REQUIRE_STAFF_2FA: value }), value).toBe(true);
  });
});

describe("effectiveRole", () => {
  const enabled = new Date();
  it("un compte d'équipe sans double authentification devient un particulier quand elle est exigée", () => {
    // Lot 265 — SUPER_ADMIN (fondateur) est le compte le plus puissant : il n'échappe pas à la règle (audit A3).
    expect(effectiveRole({ role: "SUPER_ADMIN", totpEnabledAt: null }, true)).toBe("PARTICULIER");
    expect(effectiveRole({ role: "ADMIN", totpEnabledAt: null }, true)).toBe("PARTICULIER");
    expect(effectiveRole({ role: "MODERATEUR", totpEnabledAt: null }, true)).toBe("PARTICULIER");
    expect(effectiveRole({ role: "SUPPORT", totpEnabledAt: null }, true)).toBe("PARTICULIER");
  });
  it("garde son rôle avec la double authentification, ou quand elle n'est pas exigée", () => {
    expect(effectiveRole({ role: "ADMIN", totpEnabledAt: enabled }, true)).toBe("ADMIN");
    expect(effectiveRole({ role: "ADMIN", totpEnabledAt: null }, false)).toBe("ADMIN");
    expect(effectiveRole({ role: "SUPPORT", totpEnabledAt: enabled }, true)).toBe("SUPPORT");
    expect(effectiveRole({ role: "SUPPORT", totpEnabledAt: null }, false)).toBe("SUPPORT");
  });
  it("ne touche jamais aux autres rôles", () => {
    for (const role of ["PARTICULIER", "PROFESSIONNEL"] as const) expect(effectiveRole({ role, totpEnabledAt: null }, true)).toBe(role);
    expect(isStaffRole("SUPER_ADMIN")).toBe(true);
    expect(isStaffRole("ADMIN")).toBe(true);
    expect(isStaffRole("MODERATEUR")).toBe(true);
    expect(isStaffRole("SUPPORT")).toBe(true);
    expect(isStaffRole("PROFESSIONNEL")).toBe(false);
  });
});

describe("getCurrentUser applique le rôle effectif (point unique de toutes les vérifications de droits)", () => {
  const row = (over: Record<string, unknown> = {}) => ({ id: "u1", email: "a@example.dz", role: "ADMIN", totpEnabledAt: null, suspendedAt: null, deletedAt: null, sessionsValidAfter: null, profile: null, ...over });
  const withEnv = async (env: Record<string, string>, fn: () => Promise<void>) => {
    const saved = { ...process.env };
    Object.assign(process.env, env);
    try {
      await fn();
    } finally {
      for (const key of Object.keys(env)) if (saved[key] === undefined) delete process.env[key];
      Object.assign(process.env, saved);
    }
  };

  it("un administrateur sans double authentification n'est plus ni administrateur ni membre de l'équipe", async () => {
    getSessionFromCookies.mockResolvedValue({ sub: "u1", role: "ADMIN", issuedAtMs: Date.now() });
    findUnique.mockResolvedValue(row());
    await withEnv({ REQUIRE_STAFF_2FA: "1" }, async () => {
      const user = await getCurrentUser();
      expect(user?.role).toBe("PARTICULIER");
      expect(isAdmin(user!.role)).toBe(false);
      expect(isStaff(user!.role)).toBe(false);
    });
  });

  it("un SUPER_ADMIN sans double authentification perd aussi tous ses droits quand elle est exigée (audit A3)", async () => {
    getSessionFromCookies.mockResolvedValue({ sub: "u1", role: "SUPER_ADMIN", issuedAtMs: Date.now() });
    findUnique.mockResolvedValue(row({ role: "SUPER_ADMIN" }));
    await withEnv({ REQUIRE_STAFF_2FA: "1" }, async () => {
      const user = await getCurrentUser();
      expect(user?.role).toBe("PARTICULIER");
      expect(isAdmin(user!.role)).toBe(false);
    });
  });

  it("un compte SUPPORT sans double authentification perd ses droits quand elle est exigée", async () => {
    getSessionFromCookies.mockResolvedValue({ sub: "u1", role: "SUPPORT", issuedAtMs: Date.now() });
    findUnique.mockResolvedValue(row({ role: "SUPPORT" }));
    await withEnv({ REQUIRE_STAFF_2FA: "1" }, async () => {
      const user = await getCurrentUser();
      expect(user?.role).toBe("PARTICULIER");
      expect(isStaff(user!.role)).toBe(false);
    });
  });

  it("un compte SUPPORT avec double authentification garde ses droits", async () => {
    getSessionFromCookies.mockResolvedValue({ sub: "u1", role: "SUPPORT", issuedAtMs: Date.now() });
    findUnique.mockResolvedValue(row({ role: "SUPPORT", totpEnabledAt: new Date() }));
    await withEnv({ REQUIRE_STAFF_2FA: "1" }, async () => {
      const user = await getCurrentUser();
      expect(user?.role).toBe("SUPPORT");
      expect(isStaff(user!.role)).toBe(true);
    });
  });

  it("le même compte AVEC double authentification garde tous ses droits", async () => {
    getSessionFromCookies.mockResolvedValue({ sub: "u1", role: "ADMIN", issuedAtMs: Date.now() });
    findUnique.mockResolvedValue(row({ totpEnabledAt: new Date() }));
    await withEnv({ REQUIRE_STAFF_2FA: "1" }, async () => expect((await getCurrentUser())?.role).toBe("ADMIN"));
  });

  it("quand elle n'est pas exigée, rien ne change (comptes d'équipe simples des tests et du développement)", async () => {
    getSessionFromCookies.mockResolvedValue({ sub: "u1", role: "MODERATEUR", issuedAtMs: Date.now() });
    findUnique.mockResolvedValue(row({ role: "MODERATEUR" }));
    await withEnv({ REQUIRE_STAFF_2FA: "0" }, async () => expect((await getCurrentUser())?.role).toBe("MODERATEUR"));
  });

  it("garde les autres champs du compte intacts (seul le rôle change)", async () => {
    getSessionFromCookies.mockResolvedValue({ sub: "u1", role: "ADMIN", issuedAtMs: Date.now() });
    findUnique.mockResolvedValue(row());
    await withEnv({ REQUIRE_STAFF_2FA: "1" }, async () => expect(await getCurrentUser()).toMatchObject({ id: "u1", email: "a@example.dz", totpEnabledAt: null }));
  });

  it("sans session : null, comme avant", async () => {
    getSessionFromCookies.mockResolvedValue(null);
    expect(await getCurrentUser()).toBeNull();
  });
});
