import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { expireAuthCookie } from "./cookie-expiry";

export const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-souq_auto_session" : "souq_auto_session";
const SESSION_DURATION_SECONDS = 60 * 15; // 15 minutes (le refresh token prend le relais pour la persistance)

function getSecretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET manquant — voir .env.example");
  }
  return new TextEncoder().encode(secret);
}

export type SessionPayload = {
  sub: string; // user id
  role: string;
};

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  // Lot 133 — `ims` : date d'émission en MILLISECONDES (le champ standard `iat` n'a que la seconde), pour que la
  // révocation des sessions (User.sessionsValidAfter) soit exacte même dans la seconde du changement de mot de passe.
  // Lot 229 — `jti` : identifiant unique de la session, pour la révoquer seule à la déconnexion (src/lib/auth-server/session-revocation.ts).
  return new SignJWT({ ...payload, ims: Date.now() })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setJti(crypto.randomUUID())
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecretKey());
}

// Lot 133 — date d'émission de la session (millisecondes), comparée à User.sessionsValidAfter pour révoquer les
// sessions ouvertes avant une réinitialisation de mot de passe. Une session émise avant ce lot n'a pas `ims` : on
// prend le DÉBUT de sa seconde (`iat`), donc elle est révoquée dès qu'une révocation la précède, jamais l'inverse.
// `jti` est absent des sessions émises avant le lot 229 : elles ne peuvent pas être révoquées une à une (elles expirent).
export type VerifiedSession = SessionPayload & { issuedAtMs: number; jti: string | null; expiresAtMs: number };

export async function verifySessionToken(
  token: string
): Promise<VerifiedSession | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (typeof payload.sub !== "string" || typeof payload.role !== "string") {
      return null;
    }
    // Lot 138 — un jeton « connexion en attente du second facteur » (src/lib/auth-server/two-factor-pending.ts) est signé de la
    // même clé : il ne doit JAMAIS être pris pour une session, même si quelqu'un le recopiait dans le cookie de session.
    if (payload.purpose !== undefined) return null;
    const issuedAtMs = typeof payload.ims === "number" ? payload.ims : (typeof payload.iat === "number" ? payload.iat : 0) * 1000;
    const jti = typeof payload.jti === "string" ? payload.jti : null;
    const expiresAtMs = typeof payload.exp === "number" ? payload.exp * 1000 : 0;
    return { sub: payload.sub, role: payload.role, issuedAtMs, jti, expiresAtMs };
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string) {
  const store = await cookies();
  const isProduction = process.env.NODE_ENV === "production";
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export async function clearSessionCookie() {
  await expireAuthCookie(SESSION_COOKIE);
}

export async function getSessionFromCookies(): Promise<VerifiedSession | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}
