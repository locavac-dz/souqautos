import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/http";
import { isBrowserExtensionNoise, parseCspReport } from "@/lib/csp-report";

// Lot 134 — reçoit les rapports de violation de la politique de sécurité des contenus, envoyés par le navigateur.
//
// RÉPOND TOUJOURS 204, quoi qu'on lui envoie : le navigateur n'en fait rien, et un visiteur malveillant n'apprend
// rien. Le rapport est réduit (src/lib/csp-report.ts : ni requête d'adresse, ni jeton) puis écrit en UNE ligne dans les
// journaux du serveur. Rien n'est stocké en base. Limité par adresse IP : un script qui inonde la route est ignoré.
const NO_CONTENT = () => new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });

export async function POST(request: NextRequest) {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > 8192) return NO_CONTENT();

  if (!(await checkRateLimit(`csp-report:${getClientIp(request)}`, { limit: 30, windowMs: 60 * 1000 }))) return NO_CONTENT();

  const violation = parseCspReport(await request.text().catch(() => ""));
  if (violation && !isBrowserExtensionNoise(violation)) {
    console.warn(`[csp] ${violation.directive || "?"} bloqué : ${violation.blocked || "?"} — page ${violation.page || "?"}${violation.source ? ` — source ${violation.source}${violation.line !== null ? `:${violation.line}` : ""}` : ""}`);
  }
  return NO_CONTENT();
}
