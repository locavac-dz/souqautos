import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runHeuristicTurn, runAdvisorTurn, type AdvisorMessage } from "@/lib/ai-advisor";

const catalog = {
  brands: [
    { id: 3, name: "Renault", models: [{ id: 10, name: "Clio" }, { id: 11, name: "Megane" }] },
    { id: 5, name: "Peugeot", models: [{ id: 20, name: "208" }] },
  ],
  wilayas: [
    { id: 16, nomFr: "Alger" },
    { id: 31, nomFr: "Oran" },
  ],
};

function userTurn(content: string): AdvisorMessage[] {
  return [{ role: "user", content }];
}

describe("runHeuristicTurn", () => {
  it("asks for clarification on a first turn with no extractable criteria", () => {
    const result = runHeuristicTurn(userTurn("je cherche une voiture"), catalog);
    expect(result).toEqual({ action: "clarify", filters: {}, question: null, source: "heuristic" });
  });

  it("searches immediately on a first turn when a structured criterion is found", () => {
    const result = runHeuristicTurn(userTurn("une Renault Clio diesel à Alger"), catalog);
    expect(result.action).toBe("search");
    expect(result.source).toBe("heuristic");
    expect(result.filters).toMatchObject({ brandId: "3", modelId: "10", wilayaId: "16", fuelType: "DIESEL" });
    expect(result.filters.q).toBeUndefined();
  });

  it("extracts a price ceiling expressed in millions", () => {
    const result = runHeuristicTurn(userTurn("une Peugeot 208 à moins de 1.5 million"), catalog);
    expect(result.filters.priceMax).toBe("1500000");
  });

  it("never asks a second clarifying question, even with no new signal", () => {
    const messages: AdvisorMessage[] = [
      { role: "user", content: "je cherche une voiture" },
      { role: "assistant", content: "Quelle marque ou quel budget avez-vous en tête ?" },
      { role: "user", content: "je ne sais pas encore" },
    ];
    const result = runHeuristicTurn(messages, catalog);
    expect(result.action).toBe("search");
    // Aucun critère structuré trouvé sur aucun des deux tours → résidu texte
    // libre du DERNIER message uniquement (jamais les deux tours concaténés,
    // qui ne matcherait jamais un titre réel).
    expect(result.filters).toEqual({ q: "je ne sais pas encore" });
  });

  it("accumulates structured criteria found across separate user turns", () => {
    const messages: AdvisorMessage[] = [
      { role: "user", content: "je cherche une Renault" },
      { role: "assistant", content: "Dans quelle wilaya ?" },
      { role: "user", content: "à Oran" },
    ];
    const result = runHeuristicTurn(messages, catalog);
    expect(result.action).toBe("search");
    expect(result.filters).toEqual({ brandId: "3", wilayaId: "31" });
  });

  it("never lets a structured criterion coexist with the raw free-text residual", () => {
    // Un ET entre brandId et un q contenant la phrase entière ne matcherait
    // jamais aucun titre réel — le résidu texte libre est donc exclu dès
    // qu'un critère structuré existe.
    const result = runHeuristicTurn(userTurn("une Renault avec toit ouvrant"), catalog);
    expect(result.filters).toEqual({ brandId: "3" });
  });
});

describe("runAdvisorTurn", () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  afterEach(() => {
    if (originalKey) process.env.ANTHROPIC_API_KEY = originalKey;
  });

  it("falls back to the heuristic turn when no API key is configured (no regression)", async () => {
    const messages = userTurn("une Renault Clio à Alger");
    const result = await runAdvisorTurn(messages, catalog, "fr");
    expect(result).toEqual(runHeuristicTurn(messages, catalog));
    expect(result.source).toBe("heuristic");
  });
});
