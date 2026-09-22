import { describe, expect, it } from "vitest";
import { barPosition } from "@/components/wizard/PriceRangeHint";
import { computePriceBadge } from "@/lib/price-badge";

// Lot 148 — estimation de prix dans l'assistant de publication. Ces tests couvrent les calculs
// purs (position du marqueur sur la barre, badge) sans monter de composant React.

describe("barPosition — position du prix sur la barre [0 %…100 %]", () => {
  it("prix égal à la borne basse → 0 %", () => {
    expect(barPosition(600_000, 600_000, 1_000_000)).toBe(0);
  });

  it("prix égal à la borne haute → 100 %", () => {
    expect(barPosition(1_000_000, 600_000, 1_000_000)).toBe(100);
  });

  it("prix à la médiane → 50 %", () => {
    expect(barPosition(800_000, 600_000, 1_000_000)).toBe(50);
  });

  it("prix au quart inférieur → 25 %", () => {
    expect(barPosition(700_000, 600_000, 1_000_000)).toBe(25);
  });

  it("prix en dessous du bas → clampé à 0 %", () => {
    expect(barPosition(400_000, 600_000, 1_000_000)).toBe(0);
  });

  it("prix au dessus du haut → clampé à 100 %", () => {
    expect(barPosition(1_500_000, 600_000, 1_000_000)).toBe(100);
  });

  it("fourchette nulle (high = low) → 50 % pour éviter une division par zéro", () => {
    expect(barPosition(800_000, 800_000, 800_000)).toBe(50);
  });

  it("fourchette négative (inversée) → 50 % également", () => {
    expect(barPosition(800_000, 1_000_000, 600_000)).toBe(50);
  });
});

describe("badge dans le contexte de l'assistant de publication", () => {
  const mid = 800_000;
  const size = 10;

  it("prix 20 % sous la médiane → TRES_BONNE_AFFAIRE", () => {
    const result = computePriceBadge(mid * 0.8, mid, size);
    expect(result?.badge).toBe("TRES_BONNE_AFFAIRE");
    expect(result?.deviationPct).toBe(-20);
  });

  it("prix 10 % sous la médiane → BON_PRIX", () => {
    const result = computePriceBadge(mid * 0.9, mid, size);
    expect(result?.badge).toBe("BON_PRIX");
  });

  it("prix dans la marge de ±5 % → CORRECT", () => {
    expect(computePriceBadge(mid, mid, size)?.badge).toBe("CORRECT");
    expect(computePriceBadge(mid * 1.04, mid, size)?.badge).toBe("CORRECT");
    expect(computePriceBadge(mid * 0.96, mid, size)?.badge).toBe("CORRECT");
  });

  it("prix 15 % au dessus → ELEVE", () => {
    expect(computePriceBadge(mid * 1.15, mid, size)?.badge).toBe("ELEVE");
  });

  it("prix 30 % au dessus → TRES_ELEVE", () => {
    expect(computePriceBadge(mid * 1.3, mid, size)?.badge).toBe("TRES_ELEVE");
  });

  it("moins de 3 comparables → null (pas de badge)", () => {
    expect(computePriceBadge(mid, mid, 2)).toBeNull();
    expect(computePriceBadge(mid, mid, 0)).toBeNull();
  });

  it("médiane à 0 → null (données invalides)", () => {
    expect(computePriceBadge(500_000, 0, size)).toBeNull();
  });

  it("exactement à la limite TRES_BONNE_AFFAIRE/BON_PRIX (−15 %) → TRES_BONNE_AFFAIRE", () => {
    const price = mid * 0.85;
    const result = computePriceBadge(price, mid, size);
    expect(result?.badge).toBe("TRES_BONNE_AFFAIRE");
    expect(result?.deviationPct).toBe(-15);
  });
});

describe("cohérence position + badge", () => {
  it("TRES_BONNE_AFFAIRE → marqueur dans la zone verte (gauche de la barre)", () => {
    // low=600k, high=1200k, mid=900k — prix très bas = 500k
    const price = 500_000;
    const pos = barPosition(price, 600_000, 1_200_000);
    expect(pos).toBe(0); // clampé : en dessous du bas
    const badge = computePriceBadge(price, 900_000, 5);
    expect(badge?.badge).toBe("TRES_BONNE_AFFAIRE");
  });

  it("TRES_ELEVE → marqueur dans la zone rouge (droite de la barre)", () => {
    const price = 1_500_000;
    const pos = barPosition(price, 600_000, 1_200_000);
    expect(pos).toBe(100); // clampé : au dessus du haut
    const badge = computePriceBadge(price, 900_000, 5);
    expect(badge?.badge).toBe("TRES_ELEVE");
  });
});
