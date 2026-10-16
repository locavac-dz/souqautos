// Proxy Next.js 16 (ex-« middleware ») — s'exécute avant le rendu des routes.
// Un seul fichier proxy pour toute la logique de requête (convention du dépôt) :
//  - vérification CSRF d'origine sur les requêtes mutantes (les handlers la
//    revalident aussi — défense en profondeur) ;
//  - génération d'un nonce par requête + pose des en-têtes de sécurité (CSP, HSTS…).
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isSameOriginRequest } from "@/lib/http/csrf";
import {
  readSecurityConfig,
  securityHeaders,
  buildCspValue,
  generateNonce,
} from "@/lib/http/security-headers";

export function proxy(request: NextRequest) {
  const config = readSecurityConfig();
  const nonce = generateNonce();
  const headers = securityHeaders(config, nonce);

  const apply = (response: NextResponse): NextResponse => {
    for (const [k, v] of Object.entries(headers)) response.headers.set(k, v);
    return response;
  };

  if (!isSameOriginRequest(request)) {
    return apply(NextResponse.json({ error: "Origine non autorisée." }, { status: 403 }));
  }

  // Mode nonce : propage le nonce à Next via les en-têtes de requête. Next lit le
  // nonce depuis l'en-tête `Content-Security-Policy` de la requête et l'applique à
  // ses scripts pendant le rendu (voir node_modules/next/dist/docs … CSP).
  if (config.cspMode === "nonce") {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("content-security-policy", buildCspValue(config, nonce));
    return apply(NextResponse.next({ request: { headers: requestHeaders } }));
  }

  return apply(NextResponse.next());
}

export const config = {
  // Couvre pages et /api, hors fichiers statiques.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
