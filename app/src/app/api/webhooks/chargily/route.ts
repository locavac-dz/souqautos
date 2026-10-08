import { NextRequest, NextResponse } from "next/server";
import { parseChargilyEvent, resolveChargilyConfig, verifyChargilySignature } from "@/lib/chargily";
import { applyChargilyCheckoutState, checkoutStatusFromEvent } from "@/lib/chargily-events";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/http";

export const dynamic = "force-dynamic";

// Lot 267 (audit F1) — un événement Chargily fait quelques Ko ; au-delà, inutile de lire le corps ni de calculer un
// HMAC dessus (appelant non authentifié). Et au plus 120 appels par minute et par adresse : largement au-dessus
// du rythme réel des webhooks, mais borné.
export const MAX_WEBHOOK_BODY_BYTES = 64 * 1024;

// Lot 264 — réception des événements Chargily Pay. Aucune session : l'authenticité vient de la
// signature HMAC du corps brut avec notre clé secrète. Le corps est lu en texte AVANT tout JSON.parse :
// la signature porte sur les octets reçus, pas sur une re-sérialisation.
//
// Codes de réponse : 200 dès que l'événement est authentique et lisible, même s'il ne nous concerne pas
// (checkout inconnu, commande déjà tranchée) — sinon le prestataire le renverrait indéfiniment ;
// 401 si la signature est fausse ; 400 si le corps n'est pas un événement ; 503 si le paiement en ligne
// n'est pas configuré (rien à vérifier avec).
export async function POST(request: NextRequest) {
  const resolution = resolveChargilyConfig(process.env);
  if (resolution.mode !== "enabled") {
    return NextResponse.json({ error: "chargily_not_configured" }, { status: 503 });
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_WEBHOOK_BODY_BYTES) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }
  if (!(await checkRateLimit(`chargily-webhook:${getClientIp(request)}`, { limit: 120, windowMs: 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const rawBody = await request.text();
  if (rawBody.length > MAX_WEBHOOK_BODY_BYTES) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }
  if (!verifyChargilySignature(rawBody, request.headers.get("signature"), resolution.config.secretKey)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const event = parseChargilyEvent(payload);
  if (!event) {
    return NextResponse.json({ error: "invalid_event" }, { status: 400 });
  }

  const now = new Date();
  const state = checkoutStatusFromEvent(event.type, event.data);
  const outcome = await applyChargilyCheckoutState(event.data, state, now, `chargily:${event.type}`, { source: "WEBHOOK", providerEventId: event.id ?? null });
  console.log(`[chargily] webhook ${event.type} checkout=${event.data.id} → ${outcome}`);
  return NextResponse.json({ received: true, outcome });
}
