import { NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { csrfRefusal, isApiPath } from "./lib/csrf";
import { SITE_URL } from "./lib/site";
import { CSP_REPORT_PATH, buildContentSecurityPolicy, createNonce, cspHeaderName, extraImageOrigins } from "./lib/security-headers";

const handleI18nRouting = createMiddleware(routing);

// Lot 134 — politique de sécurité des contenus (CSP) AVEC un nonce différent à chaque requête, selon
// node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md :
//  1. on fabrique le nonce et la politique ;
//  2. on les met dans les en-têtes de la REQUÊTE transmise à next-intl (qui les recopie dans celle qu'il envoie à
//     l'application) : Next.js y lit le nonce et l'applique lui-même à tous ses scripts ;
//  3. on les met aussi dans l'en-tête de la RÉPONSE, que lit le navigateur.
// Un en-tête « Content-Security-Policy » (ou sa version « observation ») envoyé par le visiteur est retiré de la requête,
// jamais repris : sinon, en mode observation, Next.js y lirait le nonce à la place du nôtre.
// Toutes les pages HTML sont rendues à chaque requête (la mise en page lit la session) : condition d'un nonce.
//
// Les requetes /api/* ne passent que par la verification CSRF d'origine (src/lib/csrf.ts) : ni CSP ni routage de
// langue, qui ne concernent que les pages. Next.js n'accepte qu'un seul fichier proxy, d'ou ce point d'entree commun.
export function proxy(request: NextRequest) {
  if (isApiPath(request.nextUrl.pathname)) return csrfRefusal(request) ?? NextResponse.next();

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
  matcher: ["/api/:path*", "/((?!api|_next|_vercel|.*\\..*).*)"],
};
