// Lot QA (audit Phase 2, M02) — protection CSRF par verification d'origine.
//
// SameSite=lax protege deja contre les formulaires cross-origin (POST), mais ne
// couvre pas les navigateurs anciens ni certains scenarii exotiques. Cette verification
// explicite de l'en-tete Origin (ou Sec-Fetch-Site) s'applique aux requetes mutatrices vers /api/.
// Elle est appelee par src/proxy.ts (Next.js 16 refuse un middleware.ts a cote d'un proxy.ts).
//
// Exemptions : webhooks (authentifies par HMAC), cron (authentifie par Bearer),
// et le endpoint CSP report (envoye par le navigateur sans controle applicatif).
import { NextResponse, type NextRequest } from "next/server";

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const EXEMPT_PREFIXES = ["/api/webhooks/", "/api/cron/", "/api/security/csp-report"];

/** Vrai pour /api et tout ce qui est en dessous (le seul perimetre de cette verification). */
export function isApiPath(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}

/** Reponse 403 si la requete mutatrice vient d'une autre origine ; null si elle peut continuer. */
export function csrfRefusal(request: NextRequest): NextResponse | null {
  if (!MUTATING.has(request.method)) return null;

  const path = request.nextUrl.pathname;
  if (EXEMPT_PREFIXES.some((p) => path.startsWith(p))) return null;

  const origin = request.headers.get("origin");
  if (origin) {
    const allowed = process.env.NEXT_PUBLIC_SITE_URL
      ? new URL(process.env.NEXT_PUBLIC_SITE_URL).origin
      : request.nextUrl.origin;
    return origin === allowed ? null : NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite && secFetchSite !== "same-origin" && secFetchSite !== "none") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  return null;
}
