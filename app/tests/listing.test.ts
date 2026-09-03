import { describe, expect, it } from "vitest";
import { listingSchema } from "@/lib/validation/listing";

const basePayload = {
  category: "VOITURE" as const,
  brandId: 1,
  modelId: 1,
  title: "Renault Clio 4 diesel, tres propre, entretien a jour",
  description: "Vehicule bien entretenu, carnet a jour, pneus neufs, aucun choc.",
  price: 2_800_000,
  year: 2019,
  mileage: 85_000,
  fuelType: "DIESEL" as const,
  gearbox: "MANUELLE" as const,
  condition: "OCCASION" as const,
  wilayaId: 16,
};

describe("listingSchema", () => {
  it("accepts a valid payload with a catalogue brand/model", () => {
    expect(listingSchema.safeParse(basePayload).success).toBe(true);
  });

  it("accepts a valid payload with a free-text brand (hors catalogue)", () => {
    const withoutCatalogueRef = { ...basePayload, brandId: undefined, modelId: undefined };
    const result = listingSchema.safeParse({
      ...withoutCatalogueRef,
      brandFreeText: "Yamaha",
      modelFreeText: "MT-07",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a payload with neither a catalogue brand nor free-text brand", () => {
    const withoutCatalogueRef = { ...basePayload, brandId: undefined, modelId: undefined };
    const result = listingSchema.safeParse(withoutCatalogueRef);
    expect(result.success).toBe(false);
  });

  it("rejects a title that is too short", () => {
    const result = listingSchema.safeParse({ ...basePayload, title: "Clio" });
    expect(result.success).toBe(false);
  });

  it("rejects an out-of-range year", () => {
    const result = listingSchema.safeParse({ ...basePayload, year: 1900 });
    expect(result.success).toBe(false);
  });

  it("rejects a negative price", () => {
    const result = listingSchema.safeParse({ ...basePayload, price: -100 });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed phone number", () => {
    const result = listingSchema.safeParse({ ...basePayload, phone: "123" });
    expect(result.success).toBe(false);
  });

  it("accepts a valid Algerian mobile phone number", () => {
    const result = listingSchema.safeParse({ ...basePayload, phone: "0555123456" });
    expect(result.success).toBe(true);
  });
});
