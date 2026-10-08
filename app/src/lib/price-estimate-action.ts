"use server";

// Lot 148 — action serveur pour l'estimation de prix dans l'assistant de publication (étape 5).
// Lot 248 — fallback IA (Claude) quand les comparables DB sont insuffisants (< 3 annonces).
// Lot 267 (audit B6) — seule action serveur du projet, elle échappait au modèle « session + limite de débit +
// Zod » des routes API : n'importe quel script pouvait déclencher des requêtes et des appels IA payants sans
// compte ni plafond. Désormais : session exigée, 30 estimations par heure et par compte, entrée validée. Une
// requête refusée répond `null` (pas d'estimation), comme une estimation indisponible : l'écran l'affiche déjà.

import { z } from "zod";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { checkRateLimit } from "@/lib/rate-limit";
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

const inputSchema = z.object({
  brandId: z.number().int().positive(),
  modelId: z.number().int().positive(),
  year: z.number().int().min(1950).max(2100).optional(),
  mileage: z.number().int().min(0).max(5_000_000).optional(),
  wilayaId: z.number().int().positive().optional(),
  equipmentIds: z.array(z.number().int().positive()).max(60).optional(),
  condition: z.string().max(20).optional(),
  fuelType: z.string().max(20).optional(),
});

const MIN_COMPARABLES_FOR_BADGE = 3;
export const PRICE_ESTIMATE_RATE_LIMIT = { limit: 30, windowMs: 60 * 60 * 1000 };

export async function getPriceEstimate(
  input: PriceEstimateInput
): Promise<PriceEstimateResponse | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return null;
  if (!(await checkRateLimit(`price-estimate:${user.id}`, PRICE_ESTIMATE_RATE_LIMIT))) return null;

  const safe = parsed.data;

  let market: EstimateResult | null = null;
  try {
    market = await estimatePrice(safe);
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
      brandId: safe.brandId,
      modelId: safe.modelId,
      year: safe.year,
      mileage: safe.mileage,
      condition: safe.condition,
      fuelType: safe.fuelType,
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
        appliedFilters: { year: Boolean(safe.year), mileage: false, wilaya: false, equipment: false },
        source: "ai",
      };
    }
  } catch {
    // Silencieux — Claude indisponible, on retombe sur les stats DB si elles existent.
  }

  // Retourne l'estimation DB même insuffisante plutôt que rien.
  return market ? { ...market, source: "market" } : null;
}
