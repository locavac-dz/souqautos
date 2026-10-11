// Lot QA (audit Phase 2, M02) — protection CSRF par verification d'origine.
//
// SameSite=lax protege deja contre les formulaires cross-origin (POST), mais ne
// couvre pas les navigateurs anciens ni certains scenarii exotiques. Ce middleware
// ajoute une verification explicite de l'en-tete Origin (ou Sec-Fetch-Site) sur
// les requetes mutatrices vers /api/.
//
// Exemptions : webhooks (authentifies par HMAC), cron (authentifie par Bearer),
// et le endpoint CSP report (envoye par le navigateur sans controle applicatif).
import { NextResponse, type NextRequest } from "next/server";

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const EXEMPT_PREFIXES = ["/api/webhooks/", "/api/cron/", "/api/security/csp-report"];

export function middleware(request: NextRequest) {
  if (!MUTATING.has(request.method)) return NextResponse.next();

  const path = request.nextUrl.pathname;
  if (EXEMPT_PREFIXES.some((p) => path.startsWith(p))) return NextResponse.next();

  const origin = request.headers.get("origin");
  if (origin) {
    const allowed = process.env.NEXT_PUBLIC_SITE_URL
      ? new URL(process.env.NEXT_PUBLIC_SITE_URL).origin
      : request.nextUrl.origin;
    if (origin !== allowed) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    return NextResponse.next();
  }

  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite && secFetchSite !== "same-origin" && secFetchSite !== "none") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
