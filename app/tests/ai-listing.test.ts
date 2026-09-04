import { describe, expect, it } from "vitest";
import { generateHeuristicSuggestion } from "@/lib/ai-listing";
import { listingSuggestionInputSchema } from "@/lib/validation/listing-suggestion";

const baseInput = {
  category: "VOITURE" as const,
  brand: "Renault",
  model: "Clio",
  year: 2019,
  mileage: 88000,
  fuelType: "DIESEL" as const,
  gearbox: "MANUELLE" as const,
  condition: "OCCASION" as const,
};

describe("generateHeuristicSuggestion", () => {
  it("builds a title from brand, model, year, fuel and condition", () => {
    const { title } = generateHeuristicSuggestion(baseInput);
    expect(title).toContain("Renault Clio");
    expect(title).toContain("2019");
    expect(title).toContain("diesel");
    expect(title).toContain("occasion");
  });

  it("keeps the title within the 120-character limit", () => {
    const { title } = generateHeuristicSuggestion(baseInput);
    expect(title.length).toBeLessThanOrEqual(120);
  });

  it("mentions the mileage in the description", () => {
    const { description } = generateHeuristicSuggestion(baseInput);
    expect(description).toContain("88");
    expect(description).toContain("km");
  });

  it("never invents a trait that was not provided (firstHand/accidented absent)", () => {
    const { description } = generateHeuristicSuggestion(baseInput);
    expect(description).not.toContain("première main");
    expect(description).not.toContain("accidenté");
  });

  it("mentions firstHand and accident-free status only when explicitly true/false", () => {
    const { description } = generateHeuristicSuggestion({
      ...baseInput,
      firstHand: true,
      accidented: false,
    });
    expect(description).toContain("première main");
    expect(description).toContain("jamais accidenté");
  });

  it("falls back to the brand alone when no model is given", () => {
    const { title } = generateHeuristicSuggestion({ ...baseInput, model: undefined });
    expect(title).toContain("Renault");
    expect(title).not.toContain("Clio");
  });
});

describe("listingSuggestionInputSchema", () => {
  it("accepts a valid input", () => {
    expect(listingSuggestionInputSchema.safeParse(baseInput).success).toBe(true);
  });

  it("rejects a missing brand", () => {
    const rest: Record<string, unknown> = { ...baseInput };
    delete rest.brand;
    expect(listingSuggestionInputSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects an out-of-range year", () => {
    expect(listingSuggestionInputSchema.safeParse({ ...baseInput, year: 1900 }).success).toBe(false);
  });
});
