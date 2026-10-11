import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/http";
import { SITE_URL } from "@/lib/site";
import {
  GOOGLE_FLOW_COOKIE,
  GOOGLE_FLOW_MAX_AGE_SECONDS,
  GOOGLE_FLOW_PATH,
  buildAuthorizationUrl,
  pickLoginLocale,
  pkceChallenge,
  randomToken,
  resolveGoogleConfig,
  sanitizeNextPath,
  sealFlow,
} from "@/lib/google-oauth";
import { apiHandler } from "@/lib/api-route";

// Lot 132 — début de la connexion avec Google : prépare l'état, le nonce et le vérificateur PKCE, les scelle dans un
// cookie court, puis renvoie le navigateur vers la page de choix de compte de Google. Voir src/lib/google-oauth.ts.
//
// Adresse relative dans `Location` (et non une adresse absolue reconstruite) : elle reste sur le domaine d'où la
// personne est venue, même derrière un serveur intermédiaire.
const redirectTo = (location: string) => new NextResponse(null, { status: 302, headers: { Location: location, "Cache-Control": "no-store" } });

export const GET = apiHandler(async (request: NextRequest) => {
  const locale = pickLoginLocale(request.nextUrl.searchParams.get("locale"));
  const login = (code: string) => redirectTo(`/${locale}/connexion?erreur=${code}`);

  const resolution = resolveGoogleConfig(process.env, SITE_URL);
  if (resolution.mode !== "enabled") return login("google_indisponible");

  if (!(await checkRateLimit(`google-start:${getClientIp(request)}`, { limit: 20, windowMs: 15 * 60 * 1000 }))) {
    return login("trop_de_tentatives");
  }

  const flow = {
    state: randomToken(),
    nonce: randomToken(),
    verifier: randomToken(64),
    locale,
    next: sanitizeNextPath(request.nextUrl.searchParams.get("next")),
  };

  const store = await cookies();
  store.set(GOOGLE_FLOW_COOKIE, await sealFlow(flow), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // « lax » : le cookie doit accompagner le retour de Google (navigation de premier niveau), jamais une requête tierce.
    sameSite: "lax",
    path: GOOGLE_FLOW_PATH,
    maxAge: GOOGLE_FLOW_MAX_AGE_SECONDS,
  });

  return redirectTo(buildAuthorizationUrl(resolution.config, { state: flow.state, nonce: flow.nonce, challenge: pkceChallenge(flow.verifier), locale }));
});
