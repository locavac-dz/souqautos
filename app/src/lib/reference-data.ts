import { prisma } from "@/lib/prisma";

// Lot 137 — cache mémoire du RÉFÉRENTIEL (marques et modèles, wilayas et communes, équipements).
//
// Constat mesuré (profil du serveur de production sous charge, docs/EXPLOITATION.md) : la page de recherche rechargeait tout ce
// référentiel à CHAQUE visite (62 marques avec leurs 410 modèles, 69 wilayas avec leurs 1 541 communes), et le client de base de
// données passait 42 % du temps du serveur à décoder ces réponses. Or ces données ne changent presque jamais.
//
//  - Durée de vie 5 minutes, par instance du serveur (aucun partage entre instances : chacune se rafraîchit toute seule).
//  - L'administration du catalogue (marques, modèles) appelle invalidateReferenceData() : son changement est visible tout de
//    suite sur l'instance qui l'a fait, et au plus 5 minutes après sur les autres. Wilayas, communes et équipements ne changent
//    que par migration (redémarrage du serveur).
//  - Chargements simultanés regroupés en un seul (pas de ruée sur la base quand le cache expire sous charge).
//  - Un échec de chargement n'est JAMAIS mis en cache : l'appel suivant réessaie.
//  - Les valeurs sont GELÉES : elles sont partagées entre toutes les requêtes, un code qui les modifierait (un tri sur place)
//    corromprait la page de tout le monde. Il reçoit une erreur immédiate au lieu d'un bogue silencieux.

export const REFERENCE_TTL_MS = 5 * 60 * 1000;
// Plafond d'entrées : les listes du référentiel sont quelques-unes, mais les comparables de prix en font une par couple
// (marque, modèle) consulté. Au-delà, la plus ancienne est retirée : la mémoire ne grossit pas avec le catalogue.
export const REFERENCE_MAX_ENTRIES = 500;

type Entry = { value: unknown; expiresAt: number };
type Store = { entries: Map<string, Entry>; inflight: Map<string, Promise<unknown>>; generation: number };

// Sur globalThis : le rechargement à chaud du mode développement recrée les modules, pas ce cache (même principe que prisma.ts).
const globalStore = globalThis as unknown as { referenceStore?: Store };
const store: Store = (globalStore.referenceStore ??= { entries: new Map(), inflight: new Map(), generation: 0 });

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value) && !(value instanceof Date)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

export async function cachedReference<T>(key: string, load: () => Promise<T>, options: { ttlMs?: number; now?: () => number } = {}): Promise<T> {
  const now = options.now ?? Date.now;
  const hit = store.entries.get(key);
  if (hit && hit.expiresAt > now()) return hit.value as T;

  const running = store.inflight.get(key);
  if (running) return running as Promise<T>;

  const generation = store.generation;
  const promise = load()
    .then((value) => {
      deepFreeze(value);
      // Invalidé PENDANT le chargement : ce résultat peut être périmé, on le rend à l'appelant mais on ne le garde pas.
      if (generation === store.generation) {
        store.entries.delete(key); // ré-inséré en dernier : l'ordre d'une Map est l'ordre d'insertion
        store.entries.set(key, { value, expiresAt: now() + (options.ttlMs ?? REFERENCE_TTL_MS) });
        while (store.entries.size > REFERENCE_MAX_ENTRIES) store.entries.delete(store.entries.keys().next().value as string);
      }
      return value;
    })
    .finally(() => {
      if (store.inflight.get(key) === promise) store.inflight.delete(key);
    });
  store.inflight.set(key, promise);
  return promise;
}

// À appeler après toute modification du catalogue (marques, modèles).
export function invalidateReferenceData(): void {
  store.generation += 1;
  store.entries.clear();
  store.inflight.clear();
}

// Réservé aux tests.
export function resetReferenceDataForTests(): void {
  invalidateReferenceData();
}

// --- Les listes de la page de recherche (les plus lourdes, les plus visitées) --------------------------------------------------

export const getSearchBrands = () =>
  cachedReference("search:brands", () =>
    prisma.brand.findMany({
      include: { models: { orderBy: { name: "asc" } } },
      orderBy: { name: "asc" },
    }),
  );

export const getSearchWilayas = () =>
  cachedReference("search:wilayas", () =>
    prisma.wilaya.findMany({
      orderBy: { id: "asc" },
      include: { communes: { orderBy: { nomFr: "asc" } } },
    }),
  );

export const getSearchEquipments = () =>
  cachedReference("search:equipments", () =>
    prisma.equipment.findMany({
      orderBy: { nameFr: "asc" },
      select: { id: true, nameFr: true, nameAr: true, category: true },
    }),
  );
