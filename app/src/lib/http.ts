import type { NextRequest } from "next/server";
import { parseTrustedProxyHops, pickClientIp } from "@/lib/client-ip";

// Voir src/lib/client-ip.ts : sans TRUSTED_PROXY_HOPS, l'en-tête X-Forwarded-For
// est pris tel quel (première valeur) et donc falsifiable par le client.
export function getClientIp(request: NextRequest): string {
  return pickClientIp(request.headers.get("x-forwarded-for"), parseTrustedProxyHops(process.env.TRUSTED_PROXY_HOPS));
}

export function safeUser<
  T extends { id: string; email: string; role: string; createdAt: Date }
>(user: T) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
}

// Lot 279 (audit E4) — conventions des réponses d'erreur des routes API, toutes en `{ error: "snake_case" }` :
//   400 validation / erreur métier d'entrée (ex. reason_required, cannot_offer_own_listing)
//   401 unauthenticated — visiteur sans session, quelle que soit la route
//   403 forbidden — session valide mais rôle ou propriété insuffisants (ex. libérer l'élément d'un collègue)
//   404 not_found — ressource inexistante OU volontairement cachée (annonce non publiée, compte supprimé)
//   409 already_* / invalid_transition perdue / second_approver_required — l'état a déjà changé
//   413 file_too_large · 429 rate_limited · 500 internal_error (apiHandler, src/lib/api-route.ts) · 503 service indisponible
// Les gardes et la lecture du corps viennent de src/lib/api-route.ts (requireUser, requireRole, parseJsonBody).
export const HTTP_STATUS = {
  validation: 400,
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
  internal_error: 500,
} as const;
