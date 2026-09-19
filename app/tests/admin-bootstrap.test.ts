import { describe, expect, it } from "vitest";
import { DEV_ADMIN_EMAIL, DEV_ADMIN_PASSWORD, resolveAdminBootstrap } from "@/lib/admin-bootstrap";

describe("resolveAdminBootstrap — development", () => {
  it("keeps the documented development account when nothing is configured", () => {
    expect(resolveAdminBootstrap({})).toEqual({ ok: true, email: DEV_ADMIN_EMAIL, password: DEV_ADMIN_PASSWORD, usesDevDefaults: true });
    expect(resolveAdminBootstrap({ NODE_ENV: "development" }).ok).toBe(true);
    expect(resolveAdminBootstrap({ NODE_ENV: "test" }).ok).toBe(true);
  });

  it("lets a developer override the credentials", () => {
    expect(resolveAdminBootstrap({ ADMIN_EMAIL: "Moi@Example.dz", ADMIN_PASSWORD: "autre-mot-de-passe" })).toEqual({
      ok: true,
      email: "moi@example.dz",
      password: "autre-mot-de-passe",
      usesDevDefaults: false,
    });
  });
});

describe("resolveAdminBootstrap — production", () => {
  const production = { NODE_ENV: "production" };

  it("never creates the well-known development administrator", () => {
    const result = resolveAdminBootstrap(production);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toContain("ADMIN_EMAIL");
  });

  it("requires both the address and the password", () => {
    expect(resolveAdminBootstrap({ ...production, ADMIN_EMAIL: "gestion@souqauto.example" }).ok).toBe(false);
    expect(resolveAdminBootstrap({ ...production, ADMIN_PASSWORD: "un-mot-de-passe-solide-2026" }).ok).toBe(false);
  });

  it("refuses the published development password, even with another address", () => {
    const result = resolveAdminBootstrap({ ...production, ADMIN_EMAIL: "gestion@souqauto.example", ADMIN_PASSWORD: DEV_ADMIN_PASSWORD });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toContain("développement");
  });

  it("refuses a short password and an invalid address", () => {
    expect(resolveAdminBootstrap({ ...production, ADMIN_EMAIL: "gestion@souqauto.example", ADMIN_PASSWORD: "court" }).ok).toBe(false);
    expect(resolveAdminBootstrap({ ...production, ADMIN_EMAIL: "pas-une-adresse", ADMIN_PASSWORD: "un-mot-de-passe-solide-2026" }).ok).toBe(false);
  });

  it("accepts a proper configuration and normalises the address", () => {
    expect(resolveAdminBootstrap({ ...production, ADMIN_EMAIL: " Gestion@SouqAuto.example ", ADMIN_PASSWORD: "un-mot-de-passe-solide-2026" })).toEqual({
      ok: true,
      email: "gestion@souqauto.example",
      password: "un-mot-de-passe-solide-2026",
      usesDevDefaults: false,
    });
  });
});
