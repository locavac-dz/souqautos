import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { expireAuthCookie } from "./cookie-expiry";

// Lot 138 — « connexion en attente du second facteur ». Quand le mot de passe (ou Google) est correct MAIS que le compte a la
// double authentification, on ne crée PAS de session : on pose ce cookie court, qui prouve seulement « cette personne a passé la
// première étape » et ne donne aucun accès. La session n'est créée qu'après un code valable (src/app/api/auth/two-factor/verify).
//
// Garde-fous :
//  - cookie distinct de celui de la session, durée de 5 minutes ;
//  - le jeton porte `purpose: "2fa"` et n'a PAS de rôle : verifySessionToken() le refuse (session.ts) — impossible de le
//    recopier dans le cookie de session pour s'en servir de session ;
//  - il désigne un compte ; le nombre d'essais de code est limité PAR COMPTE (pas par jeton) : en redemander un ne remet rien à zéro.
export const PENDING_COOKIE = process.env.NODE_ENV === "production" ? "__Host-souq_auto_2fa" : "souq_auto_2fa";
export const PENDING_DURATION_SECONDS = 5 * 60;
const PURPOSE = "2fa";

function secretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET manquant — voir .env.example");
  return new TextEncoder().encode(secret);
}

export type PendingLogin = { sub: string; next: string | null };

export async function createPendingToken({ sub, next }: { sub: string; next?: string | null }): Promise<string> {
  return new SignJWT({ purpose: PURPOSE, ...(next ? { next } : {}) })
    .setSubject(sub)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${PENDING_DURATION_SECONDS}s`)
    .sign(secretKey());
}

export async function verifyPendingToken(token: string): Promise<PendingLogin | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (payload.purpose !== PURPOSE || typeof payload.sub !== "string") return null;
    return { sub: payload.sub, next: typeof payload.next === "string" ? payload.next : null };
  } catch {
    return null;
  }
}

export async function setPendingCookie(token: string) {
  const store = await cookies();
  const isProduction = process.env.NODE_ENV === "production";
  store.set(PENDING_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: PENDING_DURATION_SECONDS,
  });
}

export async function clearPendingCookie() {
  await expireAuthCookie(PENDING_COOKIE);
}

export async function getPendingFromCookies(): Promise<PendingLogin | null> {
  const store = await cookies();
  const token = store.get(PENDING_COOKIE)?.value;
  return token ? verifyPendingToken(token) : null;
}
