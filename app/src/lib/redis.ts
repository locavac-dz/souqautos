import Redis from "ioredis";

// Client Redis partagé (rate limiting, messagerie temps réel — cf.
// src/lib/rate-limit.ts et src/lib/realtime.ts), même patron que le client
// Prisma unique (src/lib/prisma.ts) : réutilisé via `globalThis` pour ne
// jamais recréer de connexion à chaque rechargement à chaud en dev. `null`
// tant que REDIS_URL n'est pas configurée — chaque appelant garde alors son
// repli mono-instance en mémoire, comportement strictement inchangé
// (docs/ARCHITECTURE.md §6 : Redis prévu "dès que l'application tourne sur
// plusieurs instances", jamais une dépendance obligatoire du MVP).
//
// Deux connexions distinctes : une pour les commandes normales (INCR/
// PEXPIRE/PUBLISH), une dédiée aux abonnements (PSUBSCRIBE) — une connexion
// ioredis qui s'abonne ne peut plus exécuter d'autre commande, contrainte du
// protocole Redis lui-même, pas un choix arbitraire.
const globalForRedis = globalThis as unknown as {
  redisClient?: Redis | null;
  redisSubscriber?: Redis | null;
};

function createClient(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;

  const client = new Redis(url, {
    maxRetriesPerRequest: 1,
    lazyConnect: false,
    // Repli montant jusqu'à 10s entre tentatives plutôt que le défaut
    // ioredis (retente toutes les ~50-2000ms indéfiniment) — une coupure
    // Redis prolongée ne doit pas noyer les journaux applicatifs, la
    // reconnexion reste automatique dès que Redis revient.
    retryStrategy: (attempt) => Math.min(attempt * 200, 10_000),
  });
  client.on("error", (err) => {
    console.error(`[redis] erreur de connexion: ${err.message}`);
  });
  return client;
}

export function getRedisClient(): Redis | null {
  if (globalForRedis.redisClient === undefined) {
    globalForRedis.redisClient = createClient();
  }
  return globalForRedis.redisClient;
}

export function getRedisSubscriberClient(): Redis | null {
  if (globalForRedis.redisSubscriber === undefined) {
    globalForRedis.redisSubscriber = createClient();
  }
  return globalForRedis.redisSubscriber;
}
