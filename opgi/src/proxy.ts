// Proxy Next.js 16 (ex-« middleware ») — s'exécute avant le rendu des routes.
// Un seul fichier proxy pour toute la logique de requête (convention du dépôt).
// Ici : vérification CSRF d'origine sur les requêtes mutantes (défense en
// profondeur — les handlers la revalident aussi).
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isSameOriginRequest } from "@/lib/http/csrf";
import { readSecurityConfig, applySecurityHeaders } from "@/lib/http/security-headers";

export function proxy(request: NextRequest) {
  const config = readSecurityConfig();
  const response = isSameOriginRequest(request)
    ? NextResponse.next()
    : NextResponse.json({ error: "Origine non autorisée." }, { status: 403 });
  applySecurityHeaders(response.headers, config);
  return response;
}

export const config = {
  // Couvre pages et /api, hors fichiers statiques.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
