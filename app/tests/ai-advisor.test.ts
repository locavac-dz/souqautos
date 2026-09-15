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
    // Tiggo 3 volontairement sans nameAr, Tiggo 7 avec le chiffre inclus —
    // reproduit le référentiel réel (cf. correctif Lot 94/relecture qualité).
    {
      id: 9,
      name: "Chery",
      nameAr: "شيري",
      models: [{ id: 40, name: "Tiggo 3" }, { id: 41, name: "Tiggo 7", nameAr: "تيجو 7" }],
    },
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

  describe("correctifs de relecture qualité — collision de nom de modèle entre marques", () => {
    // "Duster" existe chez Dacia ET Renault dans le vrai référentiel — un
    // modèle nommé seul mais ambigu entre plusieurs marques ne doit jamais
    // faire deviner une marque au hasard.
    const catalogWithCollision = {
      brands: [
        { id: 1, name: "Renault", models: [{ id: 100, name: "Duster" }] },
        { id: 2, name: "Dacia", models: [{ id: 200, name: "Duster" }] },
      ],
      wilayas: catalog.wilayas,
    };

    it("n'assigne aucune marque quand un modèle nommé seul est ambigu entre plusieurs marques", () => {
      // Un autre critère (wilaya) force le passage en recherche — sans lui,
      // l'absence de marque/modèle assignés serait indiscernable d'une
      // simple absence totale de signal (qui déclenche une clarification).
      const result = runHeuristicTurn(userTurn("je cherche un Duster à Alger"), catalogWithCollision);
      expect(result.action).toBe("search");
      expect(result.filters.brandId).toBeUndefined();
      expect(result.filters.modelId).toBeUndefined();
      expect(result.filters.wilayaId).toBe("16");
    });

    it("assigne toujours la bonne marque quand le nom de modèle n'est pas ambigu", () => {
      const result = runHeuristicTurn(userTurn("رينو كليو"), catalog);
      expect(result.filters).toEqual({ brandId: "3", modelId: "10" });
    });
  });

  describe("correctifs de relecture qualité — nameAr générique matchant la mauvaise variante", () => {
    it("ne reconnaît jamais Tiggo 7 quand le message mentionne une autre variante non vérifiée", () => {
      // "تيجو 3" (Tiggo 3, sans nameAr dans le référentiel) ne doit jamais
      // résoudre vers Tiggo 7 seulement parce que "تيجو" y apparaît aussi —
      // ni même deviner la marque Chery, puisque son nom arabe (شيري)
      // n'apparaît pas non plus dans le message.
      const result = runHeuristicTurn(userTurn("تيجو 3 في الجزائر"), catalog);
      expect(result.filters.modelId).toBeUndefined();
      expect(result.filters.brandId).toBeUndefined();
      expect(result.filters.wilayaId).toBe("16");
    });

    it("reconnaît toujours Tiggo 7 quand le chiffre correspond (nameAr vérifié)", () => {
      const result = runHeuristicTurn(userTurn("تيجو 7 في الجزائر"), catalog);
      expect(result.filters).toMatchObject({ brandId: "9", modelId: "41", wilayaId: "16" });
    });
  });

  describe("correctifs de relecture qualité — homographe « neuf » (état vs nombre)", () => {
    // Un critère wilaya force le passage en recherche dans chaque cas — sans
    // lui, l'absence de condition serait indiscernable d'une simple absence
    // totale de signal (qui déclenche une clarification).
    it("ne confond jamais l'état « neuf » avec le nombre 9 dans un prix écrit en toutes lettres", () => {
      const result = runHeuristicTurn(userTurn("une voiture à Alger, moins de neuf cent mille da"), catalog);
      expect(result.action).toBe("search");
      expect(result.filters.condition).toBeUndefined();
      expect(result.filters.wilayaId).toBe("16");
    });

    it("ne confond jamais « neuf » dans « dix-neuf » avec l'état du véhicule", () => {
      const result = runHeuristicTurn(userTurn("un modèle dix-neuf à Alger"), catalog);
      expect(result.action).toBe("search");
      expect(result.filters.condition).toBeUndefined();
      expect(result.filters.wilayaId).toBe("16");
    });

    it("reconnaît toujours « neuf » seul comme l'état du véhicule (cas normal, non régressé)", () => {
      const result = runHeuristicTurn(userTurn("je veux une voiture neuf à Alger"), catalog);
      expect(result.filters.condition).toBe("NEUF");
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
