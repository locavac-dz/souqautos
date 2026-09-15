import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runHeuristicTurn, runAdvisorTurn, type AdvisorMessage } from "@/lib/ai-advisor";

const catalog = {
  brands: [
    {
      id: 3,
      name: "Renault",
      nameAr: "رينو",
      // Megane volontairement sans nameAr — simule un modèle pas encore
      // vérifié (cf. la plupart des modèles du référentiel réel).
      models: [{ id: 10, name: "Clio", nameAr: "كليو" }, { id: 11, name: "Megane" }],
    },
    { id: 5, name: "Peugeot", nameAr: "بيجو", models: [{ id: 20, name: "208" }] },
    // Marque volontairement sans nameAr — simule une marque du catalogue pas
    // encore vérifiée (cf. Chevrolet/Geely/Haval/Volvo/Mitsubishi en base).
    { id: 7, name: "Chevrolet", models: [{ id: 30, name: "Aveo" }] },
  ],
  wilayas: [
    { id: 16, nomFr: "Alger", nomAr: "الجزائر" },
    { id: 31, nomFr: "Oran", nomAr: "وهران" },
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

  describe("reconnaissance en écriture arabe (Lot 91)", () => {
    it("reconnaît une wilaya écrite en arabe (nomAr)", () => {
      const result = runHeuristicTurn(userTurn("سيارة في وهران"), catalog);
      expect(result.filters).toMatchObject({ wilayaId: "31" });
    });

    it("reconnaît un carburant/une boîte/un état écrits en arabe", () => {
      const result = runHeuristicTurn(userTurn("سيارة ديزل أوتوماتيكي مستعملة"), catalog);
      expect(result.filters).toEqual({ fuelType: "DIESEL", gearbox: "AUTOMATIQUE", condition: "OCCASION" });
    });

    it("extrait un prix exprimé en arabe (مليون/دج)", () => {
      const result = runHeuristicTurn(userTurn("أقل من 1.5 مليون"), catalog);
      expect(result.filters.priceMax).toBe("1500000");
    });

    it("continue de reconnaître une marque écrite en latin au sein d'une phrase arabe (code-switching)", () => {
      const result = runHeuristicTurn(userTurn("أريد Peugeot 208 في وهران"), catalog);
      expect(result.filters).toMatchObject({ brandId: "5", modelId: "20", wilayaId: "31" });
    });

    it("accumule des critères arabes et latins sur des tours séparés", () => {
      const messages: AdvisorMessage[] = [
        { role: "user", content: "أريد Renault ديزل" },
        { role: "assistant", content: "في أي ولاية؟" },
        { role: "user", content: "الجزائر" },
      ];
      const result = runHeuristicTurn(messages, catalog);
      expect(result.action).toBe("search");
      expect(result.filters).toEqual({ brandId: "3", fuelType: "DIESEL", wilayaId: "16" });
    });
  });

  describe("reconnaissance de marque en translittération arabe (Lot 92)", () => {
    it("reconnaît une marque écrite en translittération arabe (nameAr vérifié)", () => {
      const result = runHeuristicTurn(userTurn("بيجو في الجزائر"), catalog);
      expect(result.filters).toMatchObject({ brandId: "5", wilayaId: "16" });
    });

    it("reconnaît la marque même quand aucun modèle de la phrase n'est reconnu en arabe", () => {
      const result = runHeuristicTurn(userTurn("أبحث عن رينو"), catalog);
      expect(result.filters).toEqual({ brandId: "3" });
    });

    it("ne reconnaît jamais une marque non encore vérifiée en arabe (hors périmètre assumé, pas de fabrication)", () => {
      // "Chevrolet" n'a pas de nameAr dans le référentiel (comme en base
      // réelle pour Chevrolet/Geely/Haval/Volvo/Mitsubishi) — un message qui
      // ne contient AUCUN autre signal reconnaissable dégrade honnêtement
      // vers une clarification plutôt qu'une marque devinée.
      const result = runHeuristicTurn(userTurn("شيفروليه أفيو"), catalog);
      expect(result).toEqual({ action: "clarify", filters: {}, question: null, source: "heuristic" });
    });
  });

  describe("reconnaissance de modèle à nom propre en translittération arabe (Lot 94)", () => {
    it("reconnaît un modèle écrit en translittération arabe (nameAr vérifié)", () => {
      const result = runHeuristicTurn(userTurn("رينو كليو"), catalog);
      expect(result.filters).toEqual({ brandId: "3", modelId: "10" });
    });

    it("reconnaît le modèle même sans mentionner la marque explicitement", () => {
      // "كليو" seul suffit à retrouver la marque via son modèle, exactement
      // comme le code-switching latin ("Clio" seul retrouverait Renault).
      const result = runHeuristicTurn(userTurn("je veux une كليو"), catalog);
      expect(result.filters).toMatchObject({ brandId: "3", modelId: "10" });
    });

    it("ne reconnaît jamais un modèle non encore vérifié en arabe (hors périmètre assumé, pas de fabrication)", () => {
      // "Megane" n'a pas de nameAr dans le référentiel de test (comme la
      // plupart des modèles réels) — la marque reste reconnue (رينو), mais
      // aucun modèle n'est fabriqué à sa place.
      const result = runHeuristicTurn(userTurn("رينو ميغان"), catalog);
      expect(result.filters).toEqual({ brandId: "3" });
    });
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
