import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword, DUMMY_PASSWORD_HASH } from "@/lib/auth-server/password";
import { createSessionToken, verifySessionToken } from "@/lib/auth-server/session";
import { registerSchema, loginSchema, emailSchema } from "@/lib/validation/auth";

describe("password hashing", () => {
  it("hashes a password and verifies it back", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    expect(hash).not.toEqual("correct-horse-battery-staple");
    await expect(verifyPassword("correct-horse-battery-staple", hash)).resolves.toBe(true);
  });

  it("rejects the wrong password", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    await expect(verifyPassword("wrong-password", hash)).resolves.toBe(false);
  });
});

// Lot 98 (audit sécurité) : le hash factice utilisé par la route de connexion
// pour égaliser le temps de réponse d'un email inconnu (jamais de
// court-circuit qui sauterait bcrypt.compare()) doit être un vrai hash bcrypt
// valide — sinon verifyPassword échouerait immédiatement (rejet synchrone)
// au lieu d'exécuter un vrai bcrypt.compare(), ce qui recréerait exactement
// l'écart de temps que ce hash est censé éliminer.
describe("DUMMY_PASSWORD_HASH (atténuation de l'énumération de comptes par le temps de réponse)", () => {
  it("est un hash bcrypt valide qui ne correspond à aucun mot de passe réel", async () => {
    expect(DUMMY_PASSWORD_HASH).toMatch(/^\$2[aby]\$\d{2}\$/);
    await expect(verifyPassword("n'importe quel mot de passe", DUMMY_PASSWORD_HASH)).resolves.toBe(false);
    await expect(verifyPassword("", DUMMY_PASSWORD_HASH)).resolves.toBe(false);
  });
});

describe("session tokens", () => {
  it("round-trips a signed session token", async () => {
    process.env.JWT_SECRET = "test-secret-at-least-32-chars-long!!";
    const token = await createSessionToken({ sub: "user_1", role: "PARTICULIER" });
    const payload = await verifySessionToken(token);
    expect(payload).toMatchObject({ sub: "user_1", role: "PARTICULIER" });
    expect(payload?.issuedAtMs).toBeGreaterThan(Date.now() - 5000); // Lot 133 : date d'émission, utilisée pour révoquer les sessions
    expect(payload?.issuedAtMs).toBeLessThanOrEqual(Date.now());
  });

  it("rejects a tampered token", async () => {
    process.env.JWT_SECRET = "test-secret-at-least-32-chars-long!!";
    const token = await createSessionToken({ sub: "user_1", role: "PARTICULIER" });
    const tampered = token.slice(0, -2) + "xx";
    const payload = await verifySessionToken(tampered);
    expect(payload).toBeNull();
  });
});

describe("validation schemas", () => {
  it("accepts a valid registration payload", () => {
    const result = registerSchema.safeParse({
      displayName: "Amine",
      email: "amine@example.dz",
      password: "motdepasse123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a short password", () => {
    const result = registerSchema.safeParse({
      displayName: "Amine",
      email: "amine@example.dz",
      password: "short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email on login", () => {
    const result = loginSchema.safeParse({ email: "not-an-email", password: "x" });
    expect(result.success).toBe(false);
  });
});

// Lot 112 : « Ali@Example.DZ » et « ali@example.dz » sont la même adresse.
describe("email normalisation", () => {
  it("lowercases and trims the address on registration and on login, before validating it", () => {
    const register = registerSchema.parse({ displayName: "Ali", email: "  Ali.Benali@Example.DZ ", password: "motdepasse1" });
    expect(register.email).toBe("ali.benali@example.dz");
    const login = loginSchema.parse({ email: "ALI.BENALI@EXAMPLE.DZ", password: "x" });
    expect(login.email).toBe("ali.benali@example.dz");
  });

  it("gives the same result for every casing of an address, so they can only be one account", () => {
    const variants = ["a@b.dz", "A@B.DZ", "A@b.dz", "a@B.dz"];
    const emails = new Set(variants.map((email) => loginSchema.parse({ email, password: "x" }).email));
    expect(emails.size).toBe(1);
  });

  it("still rejects an invalid or oversized address", () => {
    expect(emailSchema.safeParse("pas-une-adresse").success).toBe(false);
    expect(emailSchema.safeParse(`${"a".repeat(251)}@b.dz`).success).toBe(false); // 256 caractères
    expect(emailSchema.safeParse(`${"a".repeat(250)}@b.dz`).success).toBe(true); // 255 : la limite exacte
    expect(emailSchema.safeParse("").success).toBe(false);
  });
});
