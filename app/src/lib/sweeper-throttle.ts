// Lot 213 — évite de relancer les 3 sweepers à chaque vue d'annonce.
//
// Les sweepers (expiry, reminder, auto-renew) font des updateMany sur la base à
// chaque requête sur une page d'annonce. Sous charge, cela crée une pression
// inutile : le résultat serait identique — il n'y a pas de nouvelle annonce à
// sweeper depuis la dernière exécution 3 secondes plus tôt.
//
// Fonctionnement :
//  - La première exécution dans la fenêtre glissante s'exécute toujours.
//  - Les exécutions suivantes dans la même fenêtre sont court-circuitées (no-op).
//  - Un échec ne bloque pas : la fenêtre n'est pas mise à jour, la prochaine
//    exécution peut réessayer.
//  - En test (NODE_ENV === "test"), la fenêtre est 0 : chaque appel s'exécute,
//    les tests peuvent isoler les sweepers normalement.

export const SWEEP_WINDOW_MS = process.env.NODE_ENV === "test" ? 0 : 30_000;

type SweepKey = string;
// Sur globalThis : le rechargement à chaud du mode développement recrée les modules,
// pas ce store (même principe que prisma.ts).
const globalStore = globalThis as unknown as { sweepTimestamps?: Map<SweepKey, number> };
const store: Map<SweepKey, number> = (globalStore.sweepTimestamps ??= new Map());

export function shouldRunSweep(key: SweepKey, now = Date.now()): boolean {
  if (SWEEP_WINDOW_MS <= 0) return true;
  const last = store.get(key);
  return last === undefined || now - last >= SWEEP_WINDOW_MS;
}

export function markSweepRan(key: SweepKey, now = Date.now()): void {
  store.set(key, now);
}

export async function throttledSweep(key: SweepKey, fn: () => Promise<void>, now = Date.now()): Promise<void> {
  if (!shouldRunSweep(key, now)) return;
  try {
    await fn();
    markSweepRan(key, now);
  } catch (err) {
    console.error(`[sweeper] ${key} failed:`, err);
  }
}

// Réservé aux tests.
export function resetSweepTimestampsForTests(): void {
  store.clear();
}
