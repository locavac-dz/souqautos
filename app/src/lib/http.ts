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
