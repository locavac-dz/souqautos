import { SignJWT } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPendingToken, verifyPendingToken } from "@/lib/auth-server/two-factor-pending";
import { createSessionToken, verifySessionToken } from "@/lib/auth-server/session";
import { normalizeNoticeLocale, twoFactorNoticeEmail, type TwoFactorNoticeKind } from "@/lib/two-factor-emails";

let original: string | undefined;
beforeAll(() => {
  original = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "secret-de-test-".repeat(4);
});
afterAll(() => {
  if (original === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = original;
});

describe("jeton « connexion en attente du second facteur »", () => {
  it("désigne un compte et une destination, et se relit", async () => {
    const token = await createPendingToken({ sub: "user-1", next: "/compte/mes-annonces" });
    expect(await verifyPendingToken(token)).toEqual({ sub: "user-1", next: "/compte/mes-annonces" });
    expect(await verifyPendingToken(await createPendingToken({ sub: "user-2" }))).toEqual({ sub: "user-2", next: null });
  });

  it("n'est JAMAIS pris pour une session, même signé de la même clé et recopié dans le cookie de session", async () => {
    const token = await createPendingToken({ sub: "user-1" });
    expect(await verifySessionToken(token)).toBeNull();
    // Même avec un rôle ajouté par un attaquant qui aurait la clé : le marqueur « purpose » suffit à le refuser comme session.
    const forged = await new SignJWT({ purpose: "2fa", role: "ADMIN" }).setSubject("user-1").setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("5m").sign(new TextEncoder().encode(process.env.JWT_SECRET));
    expect(await verifySessionToken(forged)).toBeNull();
  });

  it("une vraie session n'est pas non plus acceptée comme connexion en attente", async () => {
    const session = await createSessionToken({ sub: "user-1", role: "PARTICULIER" });
    expect(await verifyPendingToken(session)).toBeNull();
    expect((await verifySessionToken(session))?.sub).toBe("user-1"); // et reste une session valable
  });

  it("refuse un jeton falsifié, expiré, signé d'une autre clé, ou qui n'est pas un jeton", async () => {
    const token = await createPendingToken({ sub: "user-1" });
    expect(await verifyPendingToken(`${token}x`)).toBeNull();
    expect(await verifyPendingToken(token.replace(/\.[^.]+\./, ".e30."))).toBeNull(); // corps remplacé
    expect(await verifyPendingToken("n'importe quoi")).toBeNull();
    expect(await verifyPendingToken("")).toBeNull();
    const expired = await new SignJWT({ purpose: "2fa" }).setSubject("user-1").setProtectedHeader({ alg: "HS256" }).setIssuedAt(Math.floor(Date.now() / 1000) - 600).setExpirationTime(Math.floor(Date.now() / 1000) - 300).sign(new TextEncoder().encode(process.env.JWT_SECRET));
    expect(await verifyPendingToken(expired)).toBeNull();
    const otherKey = await new SignJWT({ purpose: "2fa" }).setSubject("user-1").setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("5m").sign(new TextEncoder().encode("une-autre-cle-secrete-".repeat(3)));
    expect(await verifyPendingToken(otherKey)).toBeNull();
  });

  it("vit cinq minutes, pas plus", async () => {
    const token = await createPendingToken({ sub: "user-1" });
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()) as { exp: number; iat: number };
    expect(payload.exp - payload.iat).toBe(300);
  });
});

describe("courriels d'avertissement de sécurité", () => {
  const kinds: TwoFactorNoticeKind[] = ["enabled", "disabled", "recovery_used", "recovery_regenerated", "reset_by_admin"];

  it.each(kinds)("« %s » existe en français et en arabe, avec un sujet, un texte et l'avertissement « ce n'est pas vous »", (kind) => {
    const fr = twoFactorNoticeEmail(kind, "fr", 4);
    const ar = twoFactorNoticeEmail(kind, "ar", 4);
    expect(fr.subject).toContain("Souq Auto");
    expect(ar.subject).toContain("سوق أوتو");
    expect(fr.html).toContain('dir="ltr"');
    expect(ar.html).toContain('dir="rtl"');
    expect(fr.html).toContain("Si ce n'est pas vous");
    expect(ar.html).toContain("إذا لم تكن أنت");
    expect(fr.subject).not.toBe(ar.subject);
  });

  it("le courriel d'un code de secours dit combien il en reste ; aucun courriel ne contient de lien, de code ni de clé", () => {
    expect(twoFactorNoticeEmail("recovery_used", "fr", 7).html).toContain("Il vous en reste 7");
    expect(twoFactorNoticeEmail("recovery_used", "ar", 7).html).toContain("7");
    for (const kind of kinds) {
      const { html } = twoFactorNoticeEmail(kind, "fr", 3);
      expect(html).not.toMatch(/https?:\/\/|href=|otpauth|secret/i);
    }
  });

  it("la langue inconnue retombe sur le français", () => {
    expect(normalizeNoticeLocale("ar")).toBe("ar");
    for (const value of ["fr", "en", "", null, undefined]) expect(normalizeNoticeLocale(value)).toBe("fr");
  });
});
