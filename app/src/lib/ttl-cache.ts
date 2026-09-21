// Lot 143 — cache mémoire à durée de vie, qui charge TOUS les éléments manquants d'une demande en UNE seule lecture.
//
// Pourquoi un second cache à côté de `cachedReference` (src/lib/reference-data.ts) : celui-là charge clé par clé, donc une page qui
// demande vingt vendeurs referait vingt lectures — exactement ce qu'on veut éviter ; et son plafond de 500 entrées est PARTAGÉ avec les
// listes de la recherche et les comparables de prix, que des centaines de vendeurs évinceraient. Ici : un plafond propre, et une
// lecture groupée des seuls manquants.
//
//  - Une entrée vit `ttlMs()` millisecondes ; une durée de 0 ou moins DÉSACTIVE le cache (chaque demande relit tout : utile aux tests
//    de bout en bout, qui modifient les données et regardent tout de suite le résultat).
//  - La plus récemment utilisée est gardée : une consultation la rajeunit ; au-delà de `maxEntries`, la plus ancienne sort.
//  - Les demandes simultanées d'un même élément partagent la même lecture (pas de ruée sur la base quand un élément expire).
//  - Un échec de lecture n'est JAMAIS mis en cache : la demande suivante réessaie.
//  - `clear()` vide le cache ET écarte les lectures en cours (leur résultat peut être périmé : rendu à l'appelant, jamais gardé).
//  - Les valeurs sont gelées : elles sont partagées entre toutes les requêtes, une modification en place la corromprait pour tous.

type Entry<T> = { value: T; expiresAt: number };

export type TtlBatchCache<T> = {
  getMany(keys: readonly string[], loadMissing: (missing: string[]) => Promise<Map<string, T>>): Promise<Map<string, T>>;
  clear(): void;
  size(): number;
};

type Registry = Map<string, TtlBatchCache<unknown>>;
// Sur globalThis : le rechargement à chaud du mode développement recrée les modules, pas ces caches (même principe que prisma.ts).
const globalRegistry = globalThis as unknown as { ttlBatchCaches?: Registry };

export function createTtlBatchCache<T>(options: { name: string; maxEntries: number; ttlMs: () => number; now?: () => number }): TtlBatchCache<T> {
  const registry: Registry = (globalRegistry.ttlBatchCaches ??= new Map());
  const existing = registry.get(options.name);
  if (existing) return existing as TtlBatchCache<T>;

  const now = options.now ?? Date.now;
  const entries = new Map<string, Entry<T>>();
  const inflight = new Map<string, Promise<T | undefined>>();
  let generation = 0;

  const freeze = (value: T): T => (value && typeof value === "object" ? Object.freeze(value) : value);

  const cache: TtlBatchCache<T> = {
    async getMany(keys, loadMissing) {
      const unique = [...new Set(keys)];
      const ttl = options.ttlMs();
      if (ttl <= 0) return loadMissing(unique); // cache désactivé : tout est relu, rien n'est gardé

      const found = new Map<string, T>();
      const waiting: [string, Promise<T | undefined>][] = [];
      const missing: string[] = [];
      for (const key of unique) {
        const hit = entries.get(key);
        if (hit && hit.expiresAt > now()) {
          entries.delete(key); // ré-inséré en dernier : l'ordre d'une Map est l'ordre d'insertion, la plus ancienne sort la première
          entries.set(key, hit);
          found.set(key, hit.value);
        } else if (inflight.has(key)) {
          waiting.push([key, inflight.get(key)!]);
        } else {
          missing.push(key);
        }
      }

      if (missing.length > 0) {
        const startedIn = generation;
        const batch = loadMissing(missing).then((loaded) => {
          if (startedIn === generation) {
            for (const key of missing) {
              const value = loaded.get(key);
              if (value === undefined) continue;
              entries.delete(key);
              entries.set(key, { value: freeze(value), expiresAt: now() + ttl });
            }
            while (entries.size > options.maxEntries) entries.delete(entries.keys().next().value as string);
          }
          return loaded;
        });
        for (const key of missing) {
          const one: Promise<T | undefined> = batch.then((loaded) => loaded.get(key));
          inflight.set(key, one);
          // Retiré une fois la lecture finie, réussie ou non — sauf si `clear()` a déjà remplacé l'entrée.
          const done = () => { if (inflight.get(key) === one) inflight.delete(key); };
          one.then(done, done);
        }
        const loaded = await batch;
        for (const key of missing) {
          const value = loaded.get(key);
          if (value !== undefined) found.set(key, value);
        }
      }

      for (const [key, promise] of waiting) {
        const value = await promise;
        if (value !== undefined) found.set(key, value);
      }
      return found;
    },

    clear() {
      generation += 1;
      entries.clear();
      inflight.clear();
    },

    size: () => entries.size,
  };

  registry.set(options.name, cache as TtlBatchCache<unknown>);
  return cache;
}

// Réservé aux tests : oublie tous les caches créés, pour que chaque test reparte d'un cache neuf.
export function resetTtlBatchCachesForTests(): void {
  globalRegistry.ttlBatchCaches?.clear();
}
