import { beforeAll, describe, expect, it } from "vitest";
import {
  encryptDeterministic,
  decryptDeterministic,
  encryptBuffer,
  decryptBuffer,
} from "@/lib/crypto/at-rest";

beforeAll(() => {
  process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
});

describe("encryptDeterministic / decryptDeterministic", () => {
  it("round-trips a phone number", () => {
    const encrypted = encryptDeterministic("0555123456");
    expect(decryptDeterministic(encrypted)).toBe("0555123456");
  });

  it("never stores the plaintext in the ciphertext", () => {
    expect(encryptDeterministic("0555123456")).not.toContain("0555123456");
  });

  it("produces the same ciphertext for the same plaintext (préserve @unique)", () => {
    expect(encryptDeterministic("0555123456")).toBe(encryptDeterministic("0555123456"));
  });

  it("produces a different ciphertext for a different plaintext", () => {
    expect(encryptDeterministic("0555123456")).not.toBe(encryptDeterministic("0666123456"));
  });
});

describe("encryptBuffer / decryptBuffer", () => {
  it("round-trips arbitrary binary content", () => {
    const original = Buffer.from([0, 1, 2, 255, 254, 253, 10, 20, 30]);
    expect(decryptBuffer(encryptBuffer(original))).toEqual(original);
  });

  it("produces a different ciphertext each time for the same content (pas de contrainte d'unicité)", () => {
    const original = Buffer.from("meme contenu");
    expect(encryptBuffer(original)).not.toEqual(encryptBuffer(original));
  });

  it("fails to decrypt if the ciphertext has been tampered with", () => {
    const tampered = encryptBuffer(Buffer.from("document sensible"));
    tampered[tampered.length - 1] ^= 0xff;
    expect(() => decryptBuffer(tampered)).toThrow();
  });
});
