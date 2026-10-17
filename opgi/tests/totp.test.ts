// Tests unitaires TOTP (RFC 6238) — logique pure, sans base.
import { describe, it, expect } from "vitest";
import {
  base32Encode,
  base32Decode,
  genererSecret,
  genererCode,
  verifierCode,
  otpauthUri,
} from "@/lib/auth/totp.js";

describe("base32", () => {
  it("round-trip encode/decode", () => {
    const octets = Buffer.from("12345678901234567890");
    expect(base32Decode(base32Encode(octets)).equals(octets)).toBe(true);
  });
  it("décodage insensible à la casse et aux espaces", () => {
    const s = base32Encode(Buffer.from("abc"));
    expect(base32Decode(s.toLowerCase()).equals(Buffer.from("abc"))).toBe(true);
  });
});

describe("genererCode (vecteur RFC 6238, SHA1)", () => {
  // Clé ASCII de référence RFC 6238 : "12345678901234567890".
  const secret = base32Encode(Buffer.from("12345678901234567890"));
  it("T=59s → 287082 (6 derniers chiffres du vecteur 94287082)", () => {
    expect(genererCode(secret, 59_000)).toBe("287082");
  });
  it("T=1111111109s → 081804 (vecteur 07081804)", () => {
    expect(genererCode(secret, 1_111_111_109_000)).toBe("081804");
  });
});

describe("verifierCode", () => {
  const secret = genererSecret();
  const t = 1_700_000_000_000;

  it("accepte le code courant", () => {
    expect(verifierCode(secret, genererCode(secret, t), t)).toBe(true);
  });
  it("tolère ±1 pas (dérive d'horloge)", () => {
    expect(verifierCode(secret, genererCode(secret, t - 30_000), t)).toBe(true);
    expect(verifierCode(secret, genererCode(secret, t + 30_000), t)).toBe(true);
  });
  it("rejette hors fenêtre", () => {
    expect(verifierCode(secret, genererCode(secret, t - 120_000), t)).toBe(false);
  });
  it("rejette un code mal formé", () => {
    expect(verifierCode(secret, "abc", t)).toBe(false);
    expect(verifierCode(secret, "12345", t)).toBe(false);
    expect(verifierCode(secret, "", t)).toBe(false);
  });
});

describe("otpauthUri", () => {
  it("contient secret, émetteur et paramètres SHA1/6/30", () => {
    const uri = otpauthUri("JBSWY3DPEHPK3PXP", "agent@opgi.dz", "Plateforme OPGI");
    expect(uri).toContain("otpauth://totp/");
    expect(uri).toContain("secret=JBSWY3DPEHPK3PXP");
    expect(uri).toContain("issuer=Plateforme+OPGI");
    expect(uri).toContain("algorithm=SHA1");
    expect(uri).toContain("digits=6");
    expect(uri).toContain("period=30");
  });
});
