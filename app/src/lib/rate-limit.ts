import { getRedisClient } from "./redis";

// Incrémente et pose le TTL (une seule fois, au premier appel de la fenêtre)
// atomiquement côté serveur Redis — un seul aller-retour réseau au lieu de
// deux commandes séparées (INCR puis PEXPIRE conditionnel), Lot 97.
const INCR_WITH_TTL_SCRIPT = `
local count = redis.call("INCR", KEYS[1])
if count == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
return count
`;

// Limiteur de débit — Redis quand REDIS_URL est configurée (partagé entre
// toutes les instances de l'application), repli en mémoire sinon (comme
// avant ce lot, suffisant pour une instance unique). Le repli reste aussi
// actif si Redis devient injoignable en cours de route : un problème
// d'infrastructure annexe ne doit jamais bloquer complètement l'application,
// seulement lui faire perdre le partage du compteur entre instances.
const attempts = new Map<string, { count: number; resetAt: number }>();

// Lot 268 (audit C9) — une entrée expirée n'était remplacée que si la même clé revenait, jamais supprimée sinon :
// avec des clés par adresse IP (audience, suggestions, connexion…), la carte grossissait indéfiniment. Purge
// opportuniste toutes les 1 000 insertions : coût amorti nul, mémoire bornée par le trafic d'une fenêtre.
const PRUNE_EVERY_INSERTS = 1_000;
let insertsSincePrune = 0;

export function pruneExpiredRateLimits(now: number = Date.now()): number {
  let removed = 0;
  for (const [key, entry] of attempts) {
    if (now > entry.resetAt) {
      attempts.delete(key);
      removed += 1;
    }
  }
  insertsSincePrune = 0;
  return removed;
}

function checkRateLimitInMemory(key: string, { limit, windowMs }: { limit: number; windowMs: number }): boolean {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || now > entry.resetAt) {
    if (!entry && ++insertsSincePrune >= PRUNE_EVERY_INSERTS) pruneExpiredRateLimits(now);
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
    // Script Lua exécuté côté serveur Redis (INCR + PEXPIRE conditionnel en
    // un seul aller-retour, cf. INCR_WITH_TTL_SCRIPT ci-dessus) — atomique,
    // pas de lecture-puis-écriture séparée qui risquerait une condition de
    // course entre deux instances. Le TTL n'est posé qu'au tout premier appel
    // de la fenêtre (count === 1) — le repositionner à chaque appel ferait
    // glisser la fenêtre indéfiniment tant que la clé reste sollicitée,
    // contraire à la sémantique "fenêtre fixe" du repli en mémoire ci-dessus.
    const redisKey = `ratelimit:${key}`;
    const count = (await redis.eval(INCR_WITH_TTL_SCRIPT, 1, redisKey, windowMs)) as number;
    return count <= limit;
  } catch (err) {
    console.error(`[rate-limit] Redis indisponible, repli en mémoire: ${(err as Error).message}`);
    return checkRateLimitInMemory(key, { limit, windowMs });
  }
}
