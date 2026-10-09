import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit, pruneExpiredRateLimits } from "@/lib/rate-limit";

// Sans REDIS_URL configurée (jamais le cas dans l'environnement de test, cf.
// src/lib/redis.ts), checkRateLimit reste sur son repli en mémoire —
// exactement le comportement d'avant le passage à Redis (Lot 90). Le vrai
// chemin Redis est vérifié manuellement en conditions réelles (deux process
// partageant la même instance Redis locale), jamais ici : même discipline
// que les intégrations externes IA du projet, qui ne mockent jamais le
// réseau dans les tests unitaires.
function uniqueKey(): string {
  return `test-${Math.random().toString(36).slice(2)}`;
}

describe("checkRateLimit (repli en mémoire)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("autorise les appels jusqu'à la limite puis rejette", async () => {
    const key = uniqueKey();
    for (let i = 0; i < 3; i++) {
      expect(await checkRateLimit(key, { limit: 3, windowMs: 60_000 })).toBe(true);
    }
    expect(await checkRateLimit(key, { limit: 3, windowMs: 60_000 })).toBe(false);
  });

  it("garde des compteurs indépendants par clé", async () => {
    const keyA = uniqueKey();
    const keyB = uniqueKey();
    expect(await checkRateLimit(keyA, { limit: 1, windowMs: 60_000 })).toBe(true);
    expect(await checkRateLimit(keyA, { limit: 1, windowMs: 60_000 })).toBe(false);
    // keyB n'a jamais été appelée — sa propre limite reste intacte.
    expect(await checkRateLimit(keyB, { limit: 1, windowMs: 60_000 })).toBe(true);
  });

  it("réinitialise le compteur une fois la fenêtre écoulée", async () => {
    const key = uniqueKey();
    expect(await checkRateLimit(key, { limit: 1, windowMs: 60_000 })).toBe(true);
    expect(await checkRateLimit(key, { limit: 1, windowMs: 60_000 })).toBe(false);

    vi.advanceTimersByTime(60_001);

    expect(await checkRateLimit(key, { limit: 1, windowMs: 60_000 })).toBe(true);
  });
});

// Lot 268 (audit C9) — la carte en mémoire ne gardait jamais une entrée expirée sauf si la même clé revenait.
describe("pruneExpiredRateLimits (repli en mémoire)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("supprime les fenêtres expirées et garde les fenêtres encore actives", async () => {
    const expired = uniqueKey();
    const active = uniqueKey();
    await checkRateLimit(expired, { limit: 3, windowMs: 1_000 });
    vi.advanceTimersByTime(5_000);
    await checkRateLimit(active, { limit: 3, windowMs: 60_000 });
    expect(pruneExpiredRateLimits()).toBeGreaterThanOrEqual(1);
    // La fenêtre active survit à la purge : le compteur continue.
    expect(await checkRateLimit(active, { limit: 2, windowMs: 60_000 })).toBe(true);
    expect(await checkRateLimit(active, { limit: 2, windowMs: 60_000 })).toBe(false);
    // La clé expirée repart de zéro.
    expect(await checkRateLimit(expired, { limit: 1, windowMs: 1_000 })).toBe(true);
  });
});
