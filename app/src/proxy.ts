import { NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { SITE_URL } from "./lib/site";
import { CSP_REPORT_PATH, buildContentSecurityPolicy, createNonce, cspHeaderName, extraImageOrigins } from "./lib/security-headers";

const handleI18nRouting = createMiddleware(routing);

// --- CSRF (ex-middleware.ts, Lot QA Phase 2 M02) ---
// SameSite=lax protège déjà contre les formulaires cross-origin (POST), mais ne
// couvre pas les navigateurs anciens. Cette vérification explicite de l'en-tête
// Origin (ou Sec-Fetch-Site) bloque les requêtes mutatrices cross-origin vers /api/.
// Exemptions : webhooks (HMAC), cron (Bearer), CSP report (navigateur).
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const EXEMPT_PREFIXES = ["/api/webhooks/", "/api/cron/", "/api/security/csp-report"];

function csrfCheck(request: NextRequest): NextResponse | null {
  if (!MUTATING.has(request.method)) return null;

  const path = request.nextUrl.pathname;
  if (EXEMPT_PREFIXES.some((p) => path.startsWith(p))) return null;

  const origin = request.headers.get("origin");
  if (origin) {
    const allowed = process.env.NEXT_PUBLIC_SITE_URL
      ? new URL(process.env.NEXT_PUBLIC_SITE_URL).origin
      : request.nextUrl.origin;
    if (origin !== allowed) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    return null;
  }

  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite && secFetchSite !== "same-origin" && secFetchSite !== "none") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  return null;
}

// --- Proxy principal ---
// Next.js 16 n'accepte qu'un seul fichier (proxy.ts) : la vérification CSRF (API)
// et le routage i18n + CSP (pages) sont réunis ici.
//
// Lot 134 — CSP avec un nonce différent à chaque requête, selon
// node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md.
export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Routes API : vérification CSRF uniquement (pas de CSP ni d'i18n).
  if (path.startsWith("/api/")) {
    const blocked = csrfCheck(request);
    return blocked ?? NextResponse.next();
  }

  // Pages : i18n + CSP.
  const nonce = createNonce();
  const policy = buildContentSecurityPolicy({
    nonce,
    isDev: process.env.NODE_ENV !== "production",
    imageOrigins: extraImageOrigins(process.env),
    reportUri: CSP_REPORT_PATH,
    upgradeInsecureRequests: SITE_URL.startsWith("https://"),
  });
  const headerName = cspHeaderName(process.env);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete("content-security-policy");
  requestHeaders.delete("content-security-policy-report-only");
  requestHeaders.set(headerName, policy);

  const response = handleI18nRouting(new NextRequest(request, { headers: requestHeaders }));
  response.headers.set(headerName, policy);
  return response;
}

export const config = {
  matcher: [
    "/api/:path*",
    "/((?!_next|_vercel|.*\\..*).*)"],
};
