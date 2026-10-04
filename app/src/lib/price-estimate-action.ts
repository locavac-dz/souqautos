"use server";

// Lot 148 — action serveur pour l'estimation de prix dans l'assistant de publication (étape 5).
// Lot 248 — fallback IA (Claude) quand les comparables DB sont insuffisants (< 3 annonces).

import { estimatePrice, type EstimateResult } from "@/lib/price-estimation";
import { estimatePriceWithAi } from "@/lib/price-ai";

export type PriceEstimateResponse = EstimateResult & { source: "market" | "ai" };

export type PriceEstimateInput = {
  brandId: number;
  modelId: number;
  year?: number;
  mileage?: number;
  wilayaId?: number;
  equipmentIds?: number[];
  condition?: string;
  fuelType?: string;
};

const MIN_COMPARABLES_FOR_BADGE = 3;

export async function getPriceEstimate(
  input: PriceEstimateInput
): Promise<PriceEstimateResponse | null> {
  if (!input.brandId || !input.modelId) return null;

  let market: EstimateResult | null = null;
  try {
    market = await estimatePrice(input);
  } catch {
    market = null;
  }

  // DB a suffisamment de comparables : on s'arrête là.
  if (market && market.sampleSize >= MIN_COMPARABLES_FOR_BADGE) {
    return { ...market, source: "market" };
  }

  // Fallback IA quand les données sont lacunaires.
  try {
    const ai = await estimatePriceWithAi({
      brandId: input.brandId,
      modelId: input.modelId,
      year: input.year,
      mileage: input.mileage,
      condition: input.condition,
      fuelType: input.fuelType,
    });

    if (ai) {
      const mid = Math.round((ai.low + ai.high) / 2);
      return {
        low: ai.low,
        mid,
        high: ai.high,
        sampleSize: 0,
        confidencePct: 30,
        confidenceLabel: "faible",
        appliedFilters: { year: Boolean(input.year), mileage: false, wilaya: false, equipment: false },
        source: "ai",
      };
    }
  } catch {
    // Silencieux — Claude indisponible, on retombe sur les stats DB si elles existent.
  }

  // Retourne l'estimation DB même insuffisante plutôt que rien.
  return market ? { ...market, source: "market" } : null;
}
