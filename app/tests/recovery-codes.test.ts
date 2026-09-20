import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { RECOVERY_CODE_COUNT, generateRecoveryCode, generateRecoveryCodes, hashRecoveryCode, normalizeRecoveryCode } from "@/lib/recovery-codes";

// Clé de chiffrement factice : l'empreinte des codes en dépend (jamais une vraie clé dans le dépôt).
const TEST_KEY = Buffer.alloc(32, 7).toString("base64");
let originalKey: string | undefined;
beforeAll(() => {
  originalKey = process.env.ENCRYPTION_KEY;
  process.env.ENCRYPTION_KEY = TEST_KEY;
});
afterAll(() => {
  if (originalKey === undefined) delete process.env.ENCRYPTION_KEY;
  else process.env.ENCRYPTION_KEY = originalKey;
});

describe("codes de secours", () => {
  it("un code : trois groupes de quatre, dans l'alphabet sans caractères ambigus (ni I, O, 0, 1)", () => {
    for (let i = 0; i < 500; i++) {
      const code = generateRecoveryCode();
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    }
  });

  it("dix codes tous différents par défaut", () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(RECOVERY_CODE_COUNT);
    expect(new Set(codes).size).toBe(RECOVERY_CODE_COUNT);
  });

  it("n'a aucun biais : les 32 caractères apparaissent à peu près autant (aucun tirage rejeté ni favorisé)", () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 4000; i++) for (const char of generateRecoveryCode().replace(/-/g, "")) counts.set(char, (counts.get(char) ?? 0) + 1);
    expect(counts.size).toBe(32);
    const expected = (4000 * 12) / 32; // 1500
    for (const [char, n] of counts) expect(Math.abs(n - expected), char).toBeLessThan(expected * 0.2);
  });

  it("normalise ce que la personne recopie : minuscules, espaces, tirets", () => {
    expect(normalizeRecoveryCode("abcd-efgh-jklm")).toBe("ABCDEFGHJKLM");
    expect(normalizeRecoveryCode(" ABCD EFGH JKLM ")).toBe("ABCDEFGHJKLM");
    expect(normalizeRecoveryCode("ABCDEFGHJKLM")).toBe("ABCDEFGHJKLM");
  });

  it("refuse tout ce qui n'est pas un code : trop court, trop long, caractère hors alphabet, code à six chiffres", () => {
    for (const bad of ["", "ABCD-EFGH", "ABCD-EFGH-JKLM-NPQR", "ABCD-EFGH-JKL0", "ABCD-EFGH-JKLI", "ABCD-EFGH-JKLO", "123456", "ABCD-EFGH-JK!M"]) {
      expect(normalizeRecoveryCode(bad), bad).toBeNull();
    }
  });

  it("l'empreinte est stable, dépend du code, et ne contient pas le code", () => {
    const a = hashRecoveryCode("ABCDEFGHJKLM");
    expect(a).toBe(hashRecoveryCode("ABCDEFGHJKLM"));
    expect(a).not.toBe(hashRecoveryCode("ABCDEFGHJKLN"));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a.toLowerCase()).not.toContain("abcdefghjklm");
  });

  it("l'empreinte dépend de la clé du serveur : une autre clé, une autre empreinte", async () => {
    const before = hashRecoveryCode("ABCDEFGHJKLM");
    const original = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
    try {
      expect(hashRecoveryCode("ABCDEFGHJKLM")).not.toBe(before);
    } finally {
      process.env.ENCRYPTION_KEY = original ?? TEST_KEY;
    }
    expect(hashRecoveryCode("ABCDEFGHJKLM")).toBe(before);
  });
});
