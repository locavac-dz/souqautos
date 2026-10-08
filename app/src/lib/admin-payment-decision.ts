import type { PaymentProvider } from "@prisma/client";
import { ChargilyApiError, resolveChargilyConfig, retrieveChargilyCheckout } from "@/lib/chargily";

// Lot 266 (audit B2) — avant qu'un admin approuve ou refuse une commande CHARGILY, on relit le checkout chez
// Chargily : la garantie « vérifier dans le tableau de bord Chargily » n'était que procédurale. Un paiement
// que Chargily déclare payé ne peut pas être refusé (l'argent est encaissé) ; un paiement non payé ne peut
// pas être approuvé. Un virement n'a pas de prestataire à interroger : toujours ok.
export type ProviderDecisionCheck =
  | { ok: true; providerStatus: string | null }
  | { ok: false; error: "paid_at_provider" | "not_paid_at_provider" | "provider_unavailable" | "chargily_not_configured"; httpStatus: number; providerStatus: string | null };

export async function checkProviderBeforeDecision(
  order: { provider: PaymentProvider; providerCheckoutId: string | null },
  action: "approve" | "reject"
): Promise<ProviderDecisionCheck> {
  if (order.provider !== "CHARGILY" || !order.providerCheckoutId) return { ok: true, providerStatus: null };

  const resolution = resolveChargilyConfig(process.env);
  if (resolution.mode !== "enabled") return { ok: false, error: "chargily_not_configured", httpStatus: 503, providerStatus: null };

  let status: string | null;
  try {
    status = (await retrieveChargilyCheckout(resolution.config, order.providerCheckoutId)).status ?? null;
  } catch (err) {
    const message = err instanceof ChargilyApiError ? err.message : (err as Error).message;
    console.error(`[chargily] relecture impossible avant décision admin (${order.providerCheckoutId}) : ${message}`);
    return { ok: false, error: "provider_unavailable", httpStatus: 502, providerStatus: null };
  }

  if (status === "paid" && action === "reject") return { ok: false, error: "paid_at_provider", httpStatus: 409, providerStatus: status };
  if (status !== "paid" && action === "approve") return { ok: false, error: "not_paid_at_provider", httpStatus: 409, providerStatus: status };
  return { ok: true, providerStatus: status };
}
