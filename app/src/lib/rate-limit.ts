import { getRedisClient } from "./redis";

// Limiteur de débit — Redis quand REDIS_URL est configurée (partagé entre
// toutes les instances de l'application), repli en mémoire sinon (comme
// avant ce lot, suffisant pour une instance unique). Le repli reste aussi
// actif si Redis devient injoignable en cours de route : un problème
// d'infrastructure annexe ne doit jamais bloquer complètement l'application,
// seulement lui faire perdre le partage du compteur entre instances.
const attempts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimitInMemory(key: string, { limit, windowMs }: { limit: number; windowMs: number }): boolean {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= limit) {
    return false;
  }

  entry.count += 1;
  return true;
}

export async function checkRateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number }
): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) {
    return checkRateLimitInMemory(key, { limit, windowMs });
  }

  try {
    // INCR crée la clé à 1 si elle n'existe pas encore (atomique, pas de
    // lecture-puis-écriture séparée qui risquerait une condition de course
    // entre deux instances). Le TTL n'est posé qu'au tout premier appel de
    // la fenêtre (count === 1) — le repositionner à chaque appel ferait
    // glisser la fenêtre indéfiniment tant que la clé reste sollicitée,
    // contraire à la sémantique "fenêtre fixe" du repli en mémoire ci-dessus.
    const redisKey = `ratelimit:${key}`;
    const count = await redis.incr(redisKey);
    if (count === 1) {
      await redis.pexpire(redisKey, windowMs);
    }
    return count <= limit;
  } catch (err) {
    console.error(`[rate-limit] Redis indisponible, repli en mémoire: ${(err as Error).message}`);
    return checkRateLimitInMemory(key, { limit, windowMs });
  }
}
