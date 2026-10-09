import { NextRequest, NextResponse } from "next/server";
import { requireUser, parseJsonBody } from "@/lib/api-route";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rate-limit";
import { refreshChargilyOrder } from "@/lib/chargily-events";

const bodySchema = z.object({
  kind: z.enum(["listing_formula", "pro_subscription"]),
  orderId: z.string().min(1).max(64),
});

// Lot 264 — relecture du statut d'un checkout CHEZ Chargily, à la demande du vendeur (« Vérifier le
// paiement »). Secours quand le webhook n'est pas arrivé (perdu, ou serveur de développement injoignable
// depuis Internet). Ce n'est pas l'acheteur qui affirme avoir payé : on interroge le prestataire avec
// notre clé secrète, puis on applique EXACTEMENT la même transition que le webhook (Lot 266 : logique
// partagée dans `refreshChargilyOrder`, tracée comme REFRESH_USER).
export async function POST(request: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  if (!(await checkRateLimit(`chargily-refresh:${user.id}`, { limit: 30, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await parseJsonBody(request, bodySchema);
  if (body instanceof NextResponse) return body;

  // Seul l'auteur de la commande peut en demander la relecture — une commande d'autrui répond 404,
  // sans révéler qu'elle existe.
  const result = await refreshChargilyOrder({
    kind: body.kind,
    orderId: body.orderId,
    now: new Date(),
    meta: { source: "REFRESH_USER", actorUserId: user.id },
    ownerUserId: user.id,
  });

  if (result.ok) {
    return NextResponse.json({ status: result.status, outcome: result.outcome, providerStatus: result.providerStatus });
  }
  switch (result.error) {
    case "not_found":
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    case "already_decided":
      return NextResponse.json({ status: result.status, outcome: "already_decided" });
    case "chargily_not_configured":
      return NextResponse.json({ error: "chargily_not_configured" }, { status: 503 });
    case "provider_unavailable":
      return NextResponse.json({ error: "provider_unavailable" }, { status: 502 });
  }
}
