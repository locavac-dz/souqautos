import { describe, expect, it } from "vitest";
import { TOTP_STEP_SECONDS, base32Decode, base32Encode, formatSecretForDisplay, generateTotpSecret, hotp, normalizeTotpInput, otpauthUri, stepAt, totpCode, verifyTotp } from "@/lib/totp";

// Secret de la RFC 6238 (annexe B) : les 20 octets ASCII « 12345678901234567890 », en base32.
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"));

describe("base32 (RFC 4648)", () => {
  it("encode les vecteurs de la RFC 4648", () => {
    expect(base32Encode(Buffer.from(""))).toBe("");
    expect(base32Encode(Buffer.from("f"))).toBe("MY");
    expect(base32Encode(Buffer.from("fo"))).toBe("MZXQ");
    expect(base32Encode(Buffer.from("foo"))).toBe("MZXW6");
    expect(base32Encode(Buffer.from("foob"))).toBe("MZXW6YQ");
    expect(base32Encode(Buffer.from("fooba"))).toBe("MZXW6YTB");
    expect(base32Encode(Buffer.from("foobar"))).toBe("MZXW6YTBOI");
  });
  it("décode en sens inverse, avec la tolérance d'une saisie à la main", () => {
    expect(base32Decode("MZXW6YTBOI").toString()).toBe("foobar");
    expect(base32Decode("mzxw 6ytb-oi==").toString()).toBe("foobar");
  });
  it("refuse ce qui n'est pas du base32 (jamais deviné)", () => {
    for (const bad of ["", "   ", "MZXW1", "MZXW8", "MZ!W", "é"]) expect(() => base32Decode(bad), bad).toThrow();
  });
  it("aller-retour sur des octets quelconques", () => {
    for (let length = 1; length < 40; length++) {
      const bytes = Buffer.from(Array.from({ length }, (_, i) => (i * 37 + length) % 256));
      expect(base32Decode(base32Encode(bytes)).equals(bytes), `${length} octets`).toBe(true);
    }
  });
});

describe("HOTP (RFC 4226, annexe D)", () => {
  // Codes à 6 chiffres du secret « 12345678901234567890 », compteurs 0 à 9.
  const expected = ["755224", "287082", "359152", "969429", "338314", "254676", "287922", "162583", "399871", "520489"];
  it.each(expected.map((code, counter) => [counter, code] as const))("compteur %i → %s", (counter, code) => {
    expect(hotp(Buffer.from("12345678901234567890"), counter)).toBe(code);
  });
});

describe("TOTP (RFC 6238, annexe B, SHA-1)", () => {
  // La RFC donne 8 chiffres ; les 6 derniers sont le code à 6 chiffres (troncature modulo 10^6).
  const vectors: [number, string, string][] = [
    [59, "94287082", "287082"],
    [1111111109, "07081804", "081804"],
    [1111111111, "14050471", "050471"],
    [1234567890, "89005924", "005924"],
    [2000000000, "69279037", "279037"],
    [20000000000, "65353130", "353130"],
  ];
  it.each(vectors)("à %i s : %s (8 chiffres) → %s (6 chiffres)", (seconds, eight, six) => {
    expect(hotp(Buffer.from("12345678901234567890"), stepAt(seconds * 1000), 8)).toBe(eight);
    expect(totpCode(RFC_SECRET, seconds * 1000)).toBe(six);
  });
  it("le code change toutes les 30 secondes, pas avant", () => {
    const start = 1_700_000_010_000; // pile au début d'un pas
    const base = stepAt(start) * TOTP_STEP_SECONDS * 1000;
    expect(totpCode(RFC_SECRET, base)).toBe(totpCode(RFC_SECRET, base + 29_999));
    expect(totpCode(RFC_SECRET, base)).not.toBe(totpCode(RFC_SECRET, base + 30_000));
  });
});

describe("verifyTotp", () => {
  const now = 1_700_000_000_000;
  const step = stepAt(now);
  const at = (offset: number) => totpCode(RFC_SECRET, (step + offset) * TOTP_STEP_SECONDS * 1000);

  it("accepte le code courant et rend son pas", () => {
    expect(verifyTotp(RFC_SECRET, at(0), { nowMs: now, lastStep: null })).toEqual({ ok: true, step });
  });
  it("tolère un téléphone en avance ou en retard d'un pas, pas de deux", () => {
    expect(verifyTotp(RFC_SECRET, at(-1), { nowMs: now, lastStep: null })).toEqual({ ok: true, step: step - 1 });
    expect(verifyTotp(RFC_SECRET, at(1), { nowMs: now, lastStep: null })).toEqual({ ok: true, step: step + 1 });
    expect(verifyTotp(RFC_SECRET, at(-2), { nowMs: now, lastStep: null }).ok).toBe(false);
    expect(verifyTotp(RFC_SECRET, at(2), { nowMs: now, lastStep: null }).ok).toBe(false);
  });
  it("REFUSE un code déjà utilisé ou plus ancien que le dernier accepté (pas de rejeu)", () => {
    expect(verifyTotp(RFC_SECRET, at(0), { nowMs: now, lastStep: step }).ok).toBe(false); // le même code, rejoué
    expect(verifyTotp(RFC_SECRET, at(-1), { nowMs: now, lastStep: step }).ok).toBe(false); // un code plus ancien
    expect(verifyTotp(RFC_SECRET, at(1), { nowMs: now, lastStep: step })).toEqual({ ok: true, step: step + 1 }); // le pas suivant reste valable
  });
  it("un dernier pas très ancien n'empêche rien : seul un pas égal ou postérieur à celui du code le bloquerait", () => {
    expect(verifyTotp(RFC_SECRET, at(0), { nowMs: now, lastStep: step - 5 })).toEqual({ ok: true, step });
  });
  it("accepte la saisie avec espace ou tiret, refuse tout ce qui n'est pas six chiffres", () => {
    const code = at(0);
    expect(verifyTotp(RFC_SECRET, `${code.slice(0, 3)} ${code.slice(3)}`, { nowMs: now, lastStep: null }).ok).toBe(true);
    expect(verifyTotp(RFC_SECRET, `${code.slice(0, 3)}-${code.slice(3)}`, { nowMs: now, lastStep: null }).ok).toBe(true);
    for (const bad of ["", "12345", "1234567", "abcdef", "12 34 5a", " "]) expect(verifyTotp(RFC_SECRET, bad, { nowMs: now, lastStep: null }).ok, bad).toBe(false);
  });
  it("refuse un mauvais code, et ne plante pas sur un secret corrompu", () => {
    const wrong = at(0) === "000000" ? "000001" : "000000";
    expect(verifyTotp(RFC_SECRET, wrong, { nowMs: now, lastStep: null }).ok).toBe(false);
    expect(verifyTotp("pas du base32 !", at(0), { nowMs: now, lastStep: null }).ok).toBe(false);
  });
  it("ne plante pas au tout début de l'horloge (les pas négatifs sont ignorés)", () => {
    expect(() => verifyTotp(RFC_SECRET, "000000", { nowMs: 0, lastStep: null })).not.toThrow();
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, 0), { nowMs: 0, lastStep: null })).toEqual({ ok: true, step: 0 });
  });
  it("un secret différent ne valide pas le code d'un autre", () => {
    const other = generateTotpSecret();
    expect(verifyTotp(other, at(0), { nowMs: now, lastStep: null }).ok).toBe(false);
  });
});

describe("secrets et adresse otpauth", () => {
  it("génère 160 bits (32 caractères base32), tous différents", () => {
    const secrets = new Set(Array.from({ length: 200 }, () => generateTotpSecret()));
    expect(secrets.size).toBe(200);
    for (const secret of secrets) {
      expect(secret).toMatch(/^[A-Z2-7]{32}$/);
      expect(base32Decode(secret)).toHaveLength(20);
    }
  });
  it("l'adresse otpauth porte le secret, l'émetteur et les paramètres, correctement encodés", () => {
    const uri = otpauthUri({ issuer: "Souq Auto", account: "amina+test@example.dz", secret: "JBSWY3DPEHPK3PXP" });
    expect(uri.startsWith("otpauth://totp/Souq%20Auto:amina%2Btest%40example.dz?")).toBe(true);
    const params = new URL(uri).searchParams;
    expect(params.get("secret")).toBe("JBSWY3DPEHPK3PXP");
    expect(params.get("issuer")).toBe("Souq Auto");
    expect(params.get("algorithm")).toBe("SHA1");
    expect(params.get("digits")).toBe("6");
    expect(params.get("period")).toBe("30");
  });
  it("affiche la clé par groupes de quatre, et normalise la saisie à six chiffres", () => {
    expect(formatSecretForDisplay("ABCDEFGHIJKLMNOP")).toBe("ABCD EFGH IJKL MNOP");
    expect(normalizeTotpInput(" 123 456 ")).toBe("123456");
    expect(normalizeTotpInput("12345")).toBeNull();
  });
});
