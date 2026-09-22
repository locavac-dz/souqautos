"use server";

// Lot 148 — action serveur pour l'estimation de prix dans l'assistant de publication (étape 5).
// L'estimation repose sur estimatePrice (src/lib/price-estimation.ts) dont le cache TTL 60 s
// fait que la même fourchette est partagée entre toutes les onglets d'un modèle : l'appel est
// bon marché. Aucune mutation, aucun secret transmis : pas de rate-limit.

import { estimatePrice, type EstimateResult } from "@/lib/price-estimation";

export type { EstimateResult };

export type PriceEstimateInput = {
  brandId: number;
  modelId: number;
  year?: number;
  mileage?: number;
  wilayaId?: number;
  equipmentIds?: number[];
};

export async function getPriceEstimate(input: PriceEstimateInput): Promise<EstimateResult | null> {
  if (!input.brandId || !input.modelId) return null;
  try {
    return await estimatePrice(input);
  } catch {
    return null;
  }
}
