import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import {
  RESET_TOKEN_TTL_MINUTES,
  buildResetLink,
  createResetToken,
  hashResetToken,
  isPlausibleResetToken,
  normalizeResetLocale,
  passwordChangedEmail,
  resetEmail,
} from "@/lib/password-reset";

describe("createResetToken / hashResetToken", () => {
  it("produces a long random token, valid for one hour, and only its SHA-256 is meant to be stored", () => {
    const now = new Date("2026-09-20T10:00:00Z");
    const { token, tokenHash, expiresAt } = createResetToken(now);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/); // 32 octets = 256 bits
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(tokenHash).toBe(createHash("sha256").update(token).digest("hex"));
    expect(tokenHash).not.toContain(token);
    expect(RESET_TOKEN_TTL_MINUTES).toBe(60);
    expect(expiresAt.toISOString()).toBe("2026-09-20T11:00:00.000Z");
  });

  it("never produces the same token twice, and hashes deterministically", () => {
    const tokens = new Set(Array.from({ length: 100 }, () => createResetToken().token));
    expect(tokens.size).toBe(100);
    expect(hashResetToken("abc")).toBe(hashResetToken("abc"));
    expect(hashResetToken("abc")).not.toBe(hashResetToken("abd"));
  });
});

describe("isPlausibleResetToken", () => {
  it("accepts exactly the shape of a token we issue", () => {
    expect(isPlausibleResetToken(createResetToken().token)).toBe(true);
    expect(isPlausibleResetToken("a".repeat(43))).toBe(true);
  });

  it("rejects anything else before the database is touched", () => {
    const bad = ["", "abc", "a".repeat(42), "a".repeat(44), "a".repeat(200), "a".repeat(42) + "/", "a".repeat(42) + " ", "a".repeat(42) + "'", "../".repeat(15), "%27%20OR%201%3D1--".padEnd(43, "a"), 12345, null, undefined, {}, ["a".repeat(43)]];
    for (const value of bad) expect(isPlausibleResetToken(value), JSON.stringify(value)).toBe(false);
  });
});

describe("links and languages", () => {
  const token = "T".repeat(43);

  it("builds the link on the site's address and the user's language, without a double slash", () => {
    expect(buildResetLink("https://souqauto.example", "fr", token)).toBe(`https://souqauto.example/fr/reinitialiser-mot-de-passe/${token}`);
    expect(buildResetLink("https://souqauto.example/", "ar", token)).toBe(`https://souqauto.example/ar/reinitialiser-mot-de-passe/${token}`);
  });

  it("falls back to French for any unknown language", () => {
    expect(normalizeResetLocale("ar")).toBe("ar");
    for (const value of ["fr", "en", "", "AR", null, undefined]) expect(normalizeResetLocale(value)).toBe("fr");
  });
});

describe("emails", () => {
  const link = `https://souqauto.example/fr/reinitialiser-mot-de-passe/${"T".repeat(43)}`;

  it("the French reset email carries the link, its lifetime and a « not you? » line", () => {
    const { subject, html } = resetEmail("fr", link);
    expect(subject).toBe("Réinitialisation de votre mot de passe — Souq Autos");
    expect(html).toContain(`href="${link}"`);
    expect(html).toContain("1 heure");
    expect(html).toContain("Si vous n'êtes pas à l'origine");
    expect(html).toContain('dir="ltr"');
  });

  it("the Arabic reset email is written right to left, with the same link", () => {
    const { subject, html } = resetEmail("ar", link.replace("/fr/", "/ar/"));
    expect(subject).toBe("إعادة تعيين كلمة المرور — سوق أوتو");
    expect(html).toContain('dir="rtl"');
    expect(html).toContain("/ar/reinitialiser-mot-de-passe/");
    expect(html).toContain("ساعة واحدة");
  });

  it("the « password changed » notice exists in both languages and never contains a link or a password", () => {
    for (const locale of ["fr", "ar"] as const) {
      const { subject, html } = passwordChangedEmail(locale);
      expect(subject.length).toBeGreaterThan(10);
      expect(html).not.toContain("http");
      expect(html).not.toContain("href");
    }
    expect(passwordChangedEmail("fr").html).toContain("déconnectés");
    expect(passwordChangedEmail("ar").html).toContain('dir="rtl"');
  });
});
