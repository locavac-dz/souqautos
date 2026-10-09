import { describe, expect, it } from "vitest";
import { DEFAULT_MAIL_FROM, resolveMailConfig } from "@/lib/mail-config";

describe("resolveMailConfig", () => {
  it("uses the test mailbox in development when no SMTP host is set", () => {
    expect(resolveMailConfig({ NODE_ENV: "development" })).toEqual({ mode: "test", from: DEFAULT_MAIL_FROM });
    expect(resolveMailConfig({})).toEqual({ mode: "test", from: DEFAULT_MAIL_FROM });
  });

  it("refuses to fall back to the test mailbox in production", () => {
    const config = resolveMailConfig({ NODE_ENV: "production" });
    expect(config.mode).toBe("error");
    expect(config.mode === "error" && config.reason).toContain("SMTP_HOST");
    expect(resolveMailConfig({ NODE_ENV: "production", SMTP_HOST: "   " }).mode).toBe("error");
  });

  it("builds an SMTP configuration with the usual defaults", () => {
    expect(resolveMailConfig({ SMTP_HOST: "smtp.example.org", SMTP_USER: "u", SMTP_PASS: "p" })).toEqual({
      mode: "smtp",
      host: "smtp.example.org",
      port: 587,
      secure: false,
      auth: { user: "u", pass: "p" },
      from: DEFAULT_MAIL_FROM,
    });
  });

  it("uses implicit TLS on port 465, and lets SMTP_SECURE override the guess", () => {
    const on465 = resolveMailConfig({ SMTP_HOST: "h", SMTP_PORT: "465", SMTP_USER: "u", SMTP_PASS: "p" });
    expect(on465.mode === "smtp" && on465.secure).toBe(true);
    const forced = resolveMailConfig({ SMTP_HOST: "h", SMTP_PORT: "2525", SMTP_SECURE: "true", SMTP_USER: "u", SMTP_PASS: "p" });
    expect(forced.mode === "smtp" && forced.secure).toBe(true);
    const off = resolveMailConfig({ SMTP_HOST: "h", SMTP_PORT: "465", SMTP_SECURE: "false", SMTP_USER: "u", SMTP_PASS: "p" });
    expect(off.mode === "smtp" && off.secure).toBe(false);
  });

  it("allows an SMTP relay without authentication, but not a half-configured login", () => {
    const relay = resolveMailConfig({ SMTP_HOST: "relay.internal" });
    expect(relay.mode === "smtp" && relay.auth).toBeUndefined();
    expect(resolveMailConfig({ SMTP_HOST: "h", SMTP_USER: "u" }).mode).toBe("error");
    expect(resolveMailConfig({ SMTP_HOST: "h", SMTP_PASS: "p" }).mode).toBe("error");
  });

  it("rejects an invalid port", () => {
    for (const SMTP_PORT of ["abc", "0", "70000", "58.7"]) {
      expect(resolveMailConfig({ SMTP_HOST: "h", SMTP_PORT, SMTP_USER: "u", SMTP_PASS: "p" }).mode).toBe("error");
    }
  });

  it("uses the configured sender address", () => {
    const config = resolveMailConfig({ SMTP_HOST: "h", SMTP_FROM: "Souq Auto <contact@souqauto.example>", SMTP_USER: "u", SMTP_PASS: "p" });
    expect(config.mode === "smtp" && config.from).toBe("Souq Auto <contact@souqauto.example>");
  });
});

// Lot 273 — adresse de réponse des courriels sortants.
import { resolveReplyTo } from "@/lib/mail-config";

describe("resolveReplyTo", () => {
  it("prend MAIL_REPLY_TO en priorité", () => {
    expect(resolveReplyTo({ MAIL_REPLY_TO: " contact@souqauto.dz ", STAFF_ALERT_EMAILS: "equipe@souqauto.dz", ADMIN_EMAIL: "pdg@souqauto.dz" })).toBe("contact@souqauto.dz");
  });

  it("se rabat sur la première adresse d'alerte de l'équipe, puis sur ADMIN_EMAIL", () => {
    expect(resolveReplyTo({ STAFF_ALERT_EMAILS: "equipe@souqauto.dz, support@souqauto.dz", ADMIN_EMAIL: "pdg@souqauto.dz" })).toBe("equipe@souqauto.dz");
    expect(resolveReplyTo({ ADMIN_EMAIL: "pdg@souqauto.dz" })).toBe("pdg@souqauto.dz");
  });

  it("ne renvoie rien sans aucune adresse (pas d'en-tête, comme avant)", () => {
    expect(resolveReplyTo({})).toBeUndefined();
    expect(resolveMailConfig({ NODE_ENV: "development" })).toMatchObject({ mode: "test", replyTo: undefined });
    expect(resolveMailConfig({ SMTP_HOST: "smtp.example", ADMIN_EMAIL: "pdg@souqauto.dz" })).toMatchObject({ mode: "smtp", replyTo: "pdg@souqauto.dz" });
  });
});
