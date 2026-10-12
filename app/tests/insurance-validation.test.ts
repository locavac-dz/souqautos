import { describe, expect, it } from "vitest";
import { quoteRequestSchema } from "@/lib/validation/insurance";

const valid = {
  fiscalPower: 7,
  year: 2024,
  wilayaId: 16,
  formula: "rc_tiers" as const,
  name: "Ali Benali",
  phone: "0555123456",
  email: "ali@example.com",
  honeypot: "",
};

describe("quoteRequestSchema", () => {
  it("accepts a valid request", () => {
    expect(quoteRequestSchema.parse(valid)).toMatchObject({ fiscalPower: 7, formula: "rc_tiers" });
  });

  it("rejects invalid formula", () => {
    expect(() => quoteRequestSchema.parse({ ...valid, formula: "premium" })).toThrow();
  });

  it("rejects fiscal power < 1", () => {
    expect(() => quoteRequestSchema.parse({ ...valid, fiscalPower: 0 })).toThrow();
  });

  it("rejects fiscal power > 99", () => {
    expect(() => quoteRequestSchema.parse({ ...valid, fiscalPower: 100 })).toThrow();
  });

  it("rejects wilaya > 69", () => {
    expect(() => quoteRequestSchema.parse({ ...valid, wilayaId: 70 })).toThrow();
  });

  it("rejects non-empty honeypot (spam)", () => {
    expect(() => quoteRequestSchema.parse({ ...valid, honeypot: "spam" })).toThrow();
  });

  it("rejects invalid email", () => {
    expect(() => quoteRequestSchema.parse({ ...valid, email: "not-an-email" })).toThrow();
  });

  it("trims name and phone", () => {
    const result = quoteRequestSchema.parse({ ...valid, name: "  Ali  ", phone: " 0555123456 " });
    expect(result.name).toBe("Ali");
    expect(result.phone).toBe("0555123456");
  });

  it("accepts all three formulas", () => {
    for (const f of ["rc", "rc_tiers", "tous_risques"] as const) {
      expect(quoteRequestSchema.parse({ ...valid, formula: f }).formula).toBe(f);
    }
  });

  it("rejects year before 1970", () => {
    expect(() => quoteRequestSchema.parse({ ...valid, year: 1969 })).toThrow();
  });
});
