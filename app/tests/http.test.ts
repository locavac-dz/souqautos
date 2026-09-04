import { describe, expect, it } from "vitest";
import type { NextRequest } from "next/server";
import { getClientIp, safeUser } from "@/lib/http";

function fakeRequest(headerValue: string | null): NextRequest {
  return {
    headers: { get: (name: string) => (name === "x-forwarded-for" ? headerValue : null) },
  } as unknown as NextRequest;
}

describe("getClientIp", () => {
  it("returns the first IP when x-forwarded-for has a single value", () => {
    expect(getClientIp(fakeRequest("203.0.113.5"))).toBe("203.0.113.5");
  });

  it("returns only the first IP when x-forwarded-for has a proxy chain", () => {
    expect(getClientIp(fakeRequest("203.0.113.5, 70.41.3.18, 150.172.238.178"))).toBe("203.0.113.5");
  });

  it("trims whitespace around the first IP", () => {
    expect(getClientIp(fakeRequest("  203.0.113.5  , 70.41.3.18"))).toBe("203.0.113.5");
  });

  it("falls back to \"local\" when the header is absent", () => {
    expect(getClientIp(fakeRequest(null))).toBe("local");
  });
});

describe("safeUser", () => {
  it("keeps only id, email, role, and createdAt", () => {
    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    const result = safeUser({
      id: "u1",
      email: "amine@example.dz",
      role: "PARTICULIER",
      createdAt,
      passwordHash: "$2b$10$secrethash",
      phone: "0555123456",
    });
    expect(result).toEqual({ id: "u1", email: "amine@example.dz", role: "PARTICULIER", createdAt });
  });

  it("never includes passwordHash even if present on the input object", () => {
    const result = safeUser({
      id: "u1",
      email: "amine@example.dz",
      role: "ADMIN",
      createdAt: new Date(),
      passwordHash: "should-never-leak",
    });
    expect(result).not.toHaveProperty("passwordHash");
  });
});
