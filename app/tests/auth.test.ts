import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth-server/password";
import { createSessionToken, verifySessionToken } from "@/lib/auth-server/session";
import { registerSchema, loginSchema } from "@/lib/validation/auth";

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

describe("session tokens", () => {
  it("round-trips a signed session token", async () => {
    process.env.JWT_SECRET = "test-secret-at-least-32-chars-long!!";
    const token = await createSessionToken({ sub: "user_1", role: "PARTICULIER" });
    const payload = await verifySessionToken(token);
    expect(payload).toEqual({ sub: "user_1", role: "PARTICULIER" });
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
