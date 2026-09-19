import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { isUniqueViolation } from "@/lib/prisma-errors";

const known = (code: string) => new Prisma.PrismaClientKnownRequestError("erreur", { code, clientVersion: "test" });

describe("isUniqueViolation", () => {
  it("recognises the Prisma unique-constraint error (P2002)", () => {
    expect(isUniqueViolation(known("P2002"))).toBe(true);
  });

  it("does not swallow other database errors, which must still surface", () => {
    expect(isUniqueViolation(known("P2003"))).toBe(false); // clé étrangère
    expect(isUniqueViolation(known("P2025"))).toBe(false); // enregistrement introuvable
  });

  it("ignores anything that is not a Prisma known request error", () => {
    expect(isUniqueViolation(new Error("P2002"))).toBe(false);
    expect(isUniqueViolation({ code: "P2002" })).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
  });
});
