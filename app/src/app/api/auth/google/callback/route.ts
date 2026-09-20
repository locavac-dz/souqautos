import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/http";
import { SITE_URL } from "@/lib/site";
import { createSessionToken, setSessionCookie } from "@/lib/auth-server/session";
import { signInWithGoogleProfile } from "@/lib/google-account";
import {
  GOOGLE_FLOW_COOKIE,
  GOOGLE_FLOW_PATH,
  decodeIdTokenClaims,
  exchangeCodeForIdToken,
  openFlow,
  resolveGoogleConfig,
  safeEqual,
  validateIdTokenClaims,
} from "@/lib/google-oauth";

// Lot 132 — retour de Google : vérifie l'état, échange le code, vérifie le jeton d'identité, puis ouvre (ou crée) le
// compte du site et sa session. Voir src/lib/google-oauth.ts et src/lib/google-account.ts.
//
// Toute erreur renvoie vers la page de connexion avec un CODE (`?erreur=…`), jamais un détail technique : ni le
// message de Google, ni l'adresse, ni le secret ne sortent du serveur. Le cookie de déroulement est supprimé dans
// tous les cas : un retour ne peut servir qu'une fois.
const redirectTo = (location: string) => new NextResponse(null, { status: 302, headers: { Location: location, "Cache-Control": "no-store" } });

const REFUSAL_CODE = {
  suspended: "compte_suspendu",
  staff: "compte_equipe",
  unverified_account: "compte_non_verifie",
  deleted: "google_invalide",
} as const;

export async function GET(request: NextRequest) {
  const store = await cookies();
  const flow = await openFlow(store.get(GOOGLE_FLOW_COOKIE)?.value);
  store.set(GOOGLE_FLOW_COOKIE, "", { path: GOOGLE_FLOW_PATH, maxAge: 0 });

  const locale = flow?.locale ?? "fr";
  const fail = (code: string) => redirectTo(`/${locale}/connexion?erreur=${code}`);

  if (!flow) return fail("google_invalide");

  const params = request.nextUrl.searchParams;
  const state = params.get("state");
  if (!state || !safeEqual(state, flow.state)) return fail("google_invalide");

  if (!(await checkRateLimit(`google-callback:${getClientIp(request)}`, { limit: 30, windowMs: 15 * 60 * 1000 }))) {
    return fail("trop_de_tentatives");
  }

  // La personne a refusé, ou fermé la fenêtre de Google.
  const googleError = params.get("error");
  if (googleError) return fail(googleError === "access_denied" ? "google_annule" : "google_echec");

  const code = params.get("code");
  if (!code || code.length > 2048) return fail("google_invalide");

  const resolution = resolveGoogleConfig(process.env, SITE_URL);
  if (resolution.mode !== "enabled") return fail("google_indisponible");

  let claims: Record<string, unknown> | null;
  try {
    claims = decodeIdTokenClaims(await exchangeCodeForIdToken(resolution.config, { code, verifier: flow.verifier }));
  } catch (error) {
    console.error(`[auth] Google : échange du code impossible — ${(error as Error).message}`);
    return fail("google_echec");
  }
  if (!claims) return fail("google_invalide");

  const validated = validateIdTokenClaims(claims, { clientId: resolution.config.clientId, nonce: flow.nonce, now: new Date() });
  if (!validated.ok) {
    console.warn(`[auth] Google : jeton d'identité refusé (${validated.reason})`);
    return fail(validated.reason === "email_unverified" ? "google_email_non_verifie" : "google_invalide");
  }

  const result = await signInWithGoogleProfile(validated.profile, flow.locale);
  if (!result.ok) return fail(REFUSAL_CODE[result.reason]);

  await setSessionCookie(await createSessionToken({ sub: result.user.id, role: result.user.role }));
  return redirectTo(`/${flow.locale}${flow.next}`);
}
