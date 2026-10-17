// Jeton de session signé (JWT HS256 via jose).
//
// La session porte l'organisme (`organisationId`) : c'est la SEULE source de
// vérité pour l'isolation (règle D3). Elle est signée côté serveur ; un client
// ne peut ni la forger ni modifier son organisme sans invalider la signature.
import { SignJWT, jwtVerify } from "jose";
import type { VerifiedSession } from "@/lib/tenant/context";

const ALG = "HS256";
const DEFAULT_TTL_SECONDS = 8 * 60 * 60; // 8 h

function keyOf(secret: string): Uint8Array {
  if (!secret || secret.length < 16) {
    throw new Error("SESSION_SECRET absent ou trop court (>= 16 caractères).");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(
  session: VerifiedSession,
  secret: string,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<string> {
  return new SignJWT({
    org: session.organisationId,
    role: session.role,
    perimetre: session.perimetre ?? null,
    epoch: session.epoch ?? 0,
  })
    .setProtectedHeader({ alg: ALG })
    .setSubject(session.utilisateurId)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttlSeconds)
    .sign(keyOf(secret));
}

/** Vérifie un jeton. Renvoie la session, ou null si invalide/expiré. */
export async function verifySession(
  token: string,
  secret: string,
): Promise<VerifiedSession | null> {
  try {
    const { payload } = await jwtVerify(token, keyOf(secret), { algorithms: [ALG] });
    const sub = payload.sub;
    const org = payload.org;
    const role = payload.role;
    if (typeof sub !== "string" || typeof org !== "string" || typeof role !== "string") {
      return null;
    }
    const perimetre = typeof payload.perimetre === "string" ? payload.perimetre : null;
    const epoch = typeof payload.epoch === "number" ? payload.epoch : 0;
    return { utilisateurId: sub, organisationId: org, role, perimetre, epoch };
  } catch {
    return null;
  }
}
