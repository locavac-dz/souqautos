import { describe, expect, it, vi } from "vitest";

// Correctif qualité (Lot 97) : checkRateLimit doit faire un seul aller-retour
// réseau Redis (un script Lua INCR+PEXPIRE conditionnel via eval), plus les
// deux commandes séparées d'avant. Mock du client Redis, jamais un vrai
// serveur ici (même discipline que tests/realtime-redis-retry.test.ts) — le
// vrai chemin Redis multi-instance reste vérifié en conditions réelles
// (Lot 90).
describe("checkRateLimit — chemin Redis (script Lua mocké)", () => {
  it("appelle eval une seule fois par requête, jamais incr/pexpire séparément", async () => {
    vi.resetModules();

    const counters = new Map<string, number>();
    const fakeClient = {
      eval: vi.fn((_script: string, _numKeys: number, key: string) => {
        const next = (counters.get(key) ?? 0) + 1;
        counters.set(key, next);
        return Promise.resolve(next);
      }),
      incr: vi.fn(),
      pexpire: vi.fn(),
    };

    vi.doMock("@/lib/redis", () => ({ getRedisClient: () => fakeClient }));
    const { checkRateLimit } = await import("@/lib/rate-limit");

    const key = "redis-test-key";
    expect(await checkRateLimit(key, { limit: 2, windowMs: 60_000 })).toBe(true);
    expect(await checkRateLimit(key, { limit: 2, windowMs: 60_000 })).toBe(true);
    expect(await checkRateLimit(key, { limit: 2, windowMs: 60_000 })).toBe(false);

    expect(fakeClient.eval).toHaveBeenCalledTimes(3);
    expect(fakeClient.incr).not.toHaveBeenCalled();
    expect(fakeClient.pexpire).not.toHaveBeenCalled();
    // Une seule clé Redis (KEYS[1]) et le TTL en argument (ARGV[1]).
    expect(fakeClient.eval).toHaveBeenCalledWith(expect.any(String), 1, `ratelimit:${key}`, 60_000);

    vi.doUnmock("@/lib/redis");
  });

  it("repli en mémoire si le script Lua échoue (Redis injoignable en cours de route)", async () => {
    vi.resetModules();

    const fakeClient = { eval: vi.fn(() => Promise.reject(new Error("connexion refusée"))) };
    vi.doMock("@/lib/redis", () => ({ getRedisClient: () => fakeClient }));
    const { checkRateLimit } = await import("@/lib/rate-limit");

    const key = "redis-down-test-key";
    expect(await checkRateLimit(key, { limit: 1, windowMs: 60_000 })).toBe(true);
    expect(await checkRateLimit(key, { limit: 1, windowMs: 60_000 })).toBe(false);

    vi.doUnmock("@/lib/redis");
  });
});
