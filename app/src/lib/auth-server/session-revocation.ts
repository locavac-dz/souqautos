import { getRedisClient } from "@/lib/redis";

// Lot 229 — sessions révoquées une à une (déconnexion). Avant ce lot, « Déconnexion » effaçait seulement le cookie : le jeton,
// valable sept jours, restait utilisable par quiconque l'avait copié. Chaque jeton porte maintenant un identifiant (`jti`,
// src/lib/auth-server/session.ts) ; à la déconnexion il est inscrit ici jusqu'à sa propre expiration, et getCurrentUser refuse
// toute session inscrite. Redis quand REDIS_URL est configurée (partagé entre instances), mémoire sinon — même repli que le
// limiteur de débit (src/lib/rate-limit.ts) : Redis injoignable ne doit jamais bloquer l'application.
const REDIS_PREFIX = "session:revoked:";

// Sur globalThis : le rechargement à chaud du mode développement recrée les modules, pas cette liste (même principe que prisma.ts).
const globalStore = globalThis as unknown as { revokedSessions?: Map<string, number> };
const revokedInMemory = (globalStore.revokedSessions ??= new Map<string, number>()); // jti → expiration (ms)

function pruneInMemory(now: number): void {
  for (const [jti, expiresAt] of revokedInMemory) if (expiresAt <= now) revokedInMemory.delete(jti);
}

export async function revokeSession(jti: string, expiresAtMs: number, now: number = Date.now()): Promise<void> {
  const ttlMs = expiresAtMs - now;
  if (ttlMs <= 0) return; // déjà expiré : rien à retenir

  const redis = getRedisClient();
  if (redis) {
    try {
      await redis.set(REDIS_PREFIX + jti, "1", "PX", ttlMs);
      return;
    } catch (err) {
      console.error(`[session] Redis indisponible, révocation gardée en mémoire : ${(err as Error).message}`);
    }
  }
  pruneInMemory(now);
  revokedInMemory.set(jti, expiresAtMs);
}

export async function isSessionRevoked(jti: string, now: number = Date.now()): Promise<boolean> {
  const redis = getRedisClient();
  if (redis) {
    try {
      if ((await redis.exists(REDIS_PREFIX + jti)) === 1) return true;
    } catch (err) {
      console.error(`[session] Redis indisponible, révocations lues en mémoire : ${(err as Error).message}`);
    }
  }
  const expiresAt = revokedInMemory.get(jti);
  if (expiresAt === undefined) return false;
  if (expiresAt <= now) {
    revokedInMemory.delete(jti);
    return false;
  }
  return true;
}

// Réservé aux tests.
export function resetSessionRevocationForTests(): void {
  revokedInMemory.clear();
}
