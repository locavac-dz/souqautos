import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTtlBatchCache, resetTtlBatchCachesForTests } from "@/lib/ttl-cache";

// Lot 143 — le cache à durée de vie qui charge les manquants en UNE lecture (src/lib/ttl-cache.ts).

let clock = 0;
let ttl = 1000;
let counter = 0;

function makeCache(maxEntries = 100) {
  // Un nom neuf par test : le registre est global (pour survivre au rechargement à chaud), il ne doit pas lier deux tests entre eux.
  return createTtlBatchCache<{ n: string }>({ name: `test-${counter++}`, maxEntries, ttlMs: () => ttl, now: () => clock });
}

// Un chargeur espionné : rend { n: "valeur-<clé>" } pour chaque clé demandée.
function makeLoader() {
  return vi.fn(async (missing: string[]) => new Map(missing.map((key) => [key, { n: `valeur-${key}` }])));
}

beforeEach(() => {
  resetTtlBatchCachesForTests();
  clock = 0;
  ttl = 1000;
});

describe("lecture groupée des manquants", () => {
  it("charge tous les manquants en UNE lecture, puis ne recharge que ce qui manque encore", async () => {
    const cache = makeCache();
    const load = makeLoader();
    const first = await cache.getMany(["a", "b", "c"], load);
    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenLastCalledWith(["a", "b", "c"]);
    expect([...first.keys()].sort()).toEqual(["a", "b", "c"]);

    const second = await cache.getMany(["b", "c", "d"], load);
    expect(load).toHaveBeenCalledTimes(2);
    expect(load).toHaveBeenLastCalledWith(["d"]); // seul « d » manquait
    expect(second.get("b")).toEqual({ n: "valeur-b" }); // et « b », « c » viennent du cache
    expect([...second.keys()].sort()).toEqual(["b", "c", "d"]);
  });

  it("ne lit rien du tout quand tout est déjà en cache", async () => {
    const cache = makeCache();
    const load = makeLoader();
    await cache.getMany(["a", "b"], load);
    load.mockClear();
    const again = await cache.getMany(["a", "b"], load);
    expect(load).not.toHaveBeenCalled();
    expect(again.size).toBe(2);
  });

  it("dédoublonne les clés demandées et accepte une demande vide", async () => {
    const cache = makeCache();
    const load = makeLoader();
    expect((await cache.getMany(["a", "a", "b", "a"], load)).size).toBe(2);
    expect(load).toHaveBeenLastCalledWith(["a", "b"]);
    load.mockClear();
    expect((await cache.getMany([], load)).size).toBe(0);
  });

  it("omet du résultat une clé que le chargeur ne connaît pas, et ne la met pas en cache", async () => {
    const cache = makeCache();
    const load = vi.fn(async () => new Map<string, { n: string }>([["a", { n: "A" }]]));
    const result = await cache.getMany(["a", "inconnue"], load);
    expect([...result.keys()]).toEqual(["a"]);
    expect(cache.size()).toBe(1);
  });
});

describe("durée de vie", () => {
  it("garde une entrée jusqu'à sa durée de vie, puis la relit", async () => {
    const cache = makeCache();
    const load = makeLoader();
    await cache.getMany(["a"], load);
    clock = 999;
    await cache.getMany(["a"], load);
    expect(load).toHaveBeenCalledTimes(1); // encore valable une milliseconde avant l'échéance
    clock = 1000;
    await cache.getMany(["a"], load);
    expect(load).toHaveBeenCalledTimes(2); // périmée pile à l'échéance
  });

  it("une durée nulle ou négative DÉSACTIVE le cache : tout est relu et rien n'est gardé", async () => {
    const cache = makeCache();
    const load = makeLoader();
    for (const disabled of [0, -5]) {
      ttl = disabled;
      await cache.getMany(["a", "b"], load);
      await cache.getMany(["a", "b"], load);
    }
    expect(load).toHaveBeenCalledTimes(4);
    expect(load).toHaveBeenLastCalledWith(["a", "b"]);
    expect(cache.size()).toBe(0);
  });

  it("relit la durée à CHAQUE demande (elle peut venir d'un réglage qui change)", async () => {
    const cache = makeCache();
    const load = makeLoader();
    await cache.getMany(["a"], load);
    ttl = 0;
    await cache.getMany(["a"], load);
    expect(load).toHaveBeenCalledTimes(2); // désactivé entre-temps : relu malgré l'entrée encore fraîche
  });
});

describe("plafond : la moins récemment utilisée sort", () => {
  it("garde une entrée consultée récemment et évince la plus ancienne", async () => {
    const cache = makeCache(3);
    const load = makeLoader();
    await cache.getMany(["a", "b", "c"], load);
    await cache.getMany(["a"], load); // « a » devient la plus récente : l'ordre d'ancienneté est b, c, a
    await cache.getMany(["d"], load); // dépasse le plafond : « b » sort
    expect(cache.size()).toBe(3);
    load.mockClear();
    await cache.getMany(["a"], load);
    expect(load).not.toHaveBeenCalled(); // « a », consultée, est restée
    await cache.getMany(["b"], load);
    expect(load).toHaveBeenCalledTimes(1); // « b », la plus ancienne, est sortie
    expect(load).toHaveBeenLastCalledWith(["b"]);
  });

  it("ne dépasse jamais le plafond, même avec une demande plus grosse que lui", async () => {
    const cache = makeCache(3);
    await cache.getMany(["a", "b", "c", "d", "e", "f"], makeLoader());
    expect(cache.size()).toBe(3);
  });
});

describe("demandes simultanées", () => {
  it("partagent la lecture d'un même élément au lieu de la refaire", async () => {
    const cache = makeCache();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const load = vi.fn(async (missing: string[]) => {
      await gate;
      return new Map(missing.map((key) => [key, { n: `valeur-${key}` }]));
    });

    const first = cache.getMany(["a", "b"], load);
    const second = cache.getMany(["b", "c"], load); // « b » est déjà en cours de lecture
    release();
    const [one, two] = await Promise.all([first, second]);

    expect(load).toHaveBeenCalledTimes(2);
    expect(load).toHaveBeenNthCalledWith(1, ["a", "b"]);
    expect(load).toHaveBeenNthCalledWith(2, ["c"]); // « b » n'est PAS relu
    expect(one.get("b")).toEqual({ n: "valeur-b" });
    expect(two.get("b")).toEqual({ n: "valeur-b" }); // la seconde demande reçoit bien son « b »
    expect([...two.keys()].sort()).toEqual(["b", "c"]);
  });

  it("trente demandes identiques simultanées ne lisent qu'une fois", async () => {
    const cache = makeCache();
    const load = makeLoader();
    await Promise.all(Array.from({ length: 30 }, () => cache.getMany(["a", "b", "c"], load)));
    expect(load).toHaveBeenCalledTimes(1);
  });
});

describe("échecs et invalidation", () => {
  it("un échec n'est PAS mis en cache : la demande suivante réessaie", async () => {
    const cache = makeCache();
    let attempts = 0;
    const flaky = async (missing: string[]) => {
      attempts += 1;
      if (attempts === 1) throw new Error("base indisponible");
      return new Map(missing.map((key) => [key, { n: key }]));
    };
    await expect(cache.getMany(["a"], flaky)).rejects.toThrow("base indisponible");
    expect(cache.size()).toBe(0);
    expect((await cache.getMany(["a"], flaky)).get("a")).toEqual({ n: "a" });
    expect(attempts).toBe(2);
  });

  it("un échec atteint aussi la demande qui attendait la même lecture, sans rien laisser derrière lui", async () => {
    const cache = makeCache();
    let fail: (error: Error) => void = () => undefined;
    const doomed = vi.fn(() => new Promise<Map<string, { n: string }>>((_, reject) => { fail = reject; }));
    const first = cache.getMany(["a"], doomed);
    const second = cache.getMany(["a"], makeLoader()); // attend la lecture de « a » déjà en cours
    fail(new Error("coupure"));
    await expect(first).rejects.toThrow("coupure");
    await expect(second).rejects.toThrow("coupure");
    // La lecture ratée ne bloque pas la suite : « a » se recharge normalement.
    expect((await cache.getMany(["a"], makeLoader())).get("a")).toEqual({ n: "valeur-a" });
  });

  it("clear() vide le cache", async () => {
    const cache = makeCache();
    const load = makeLoader();
    await cache.getMany(["a"], load);
    cache.clear();
    expect(cache.size()).toBe(0);
    await cache.getMany(["a"], load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("une demande faite juste APRÈS clear() ne rejoint pas une lecture démarrée avant : elle relit", async () => {
    const cache = makeCache();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const stale = vi.fn(async (missing: string[]) => {
      await gate;
      return new Map(missing.map((key) => [key, { n: `ancienne-${key}` }]));
    });
    const before = cache.getMany(["a"], stale);
    cache.clear(); // les données changent alors que la lecture d'avant est encore en route
    const fresh = vi.fn(async (missing: string[]) => new Map(missing.map((key) => [key, { n: `nouvelle-${key}` }])));
    const after = cache.getMany(["a"], fresh); // demandée APRÈS le clear(), avant la fin de la lecture périmée
    release();
    await before;
    expect(fresh).toHaveBeenCalledTimes(1); // elle relit : elle n'attend pas la valeur périmée
    expect((await after).get("a")).toEqual({ n: "nouvelle-a" });
  });

  it("clear() PENDANT une lecture : le résultat est rendu à l'appelant mais jamais gardé (il peut être périmé)", async () => {
    const cache = makeCache();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const slow = vi.fn(async (missing: string[]) => {
      await gate;
      return new Map(missing.map((key) => [key, { n: `ancienne-${key}` }]));
    });
    const pending = cache.getMany(["a"], slow);
    cache.clear(); // les données changent pendant que la lecture est en route
    release();
    expect((await pending).get("a")).toEqual({ n: "ancienne-a" }); // l'appelant reçoit ce qu'il a demandé...
    expect(cache.size()).toBe(0); // ...mais la valeur, peut-être périmée, n'est pas gardée
    const fresh = vi.fn(async (missing: string[]) => new Map(missing.map((key) => [key, { n: `nouvelle-${key}` }])));
    expect((await cache.getMany(["a"], fresh)).get("a")).toEqual({ n: "nouvelle-a" });
  });
});

describe("valeurs partagées", () => {
  it("les valeurs gardées sont gelées : personne ne peut corrompre la réponse des autres", async () => {
    const cache = makeCache();
    const value = (await cache.getMany(["a"], makeLoader())).get("a")!;
    expect(Object.isFrozen(value)).toBe(true);
    expect(() => { (value as { n: string }).n = "corrompu"; }).toThrow(TypeError);
    expect((await cache.getMany(["a"], makeLoader())).get("a")).toEqual({ n: "valeur-a" });
  });

  it("deux caches de même nom sont un seul cache (survie au rechargement à chaud du mode développement)", async () => {
    const one = createTtlBatchCache<{ n: string }>({ name: "partage", maxEntries: 10, ttlMs: () => 1000, now: () => clock });
    const two = createTtlBatchCache<{ n: string }>({ name: "partage", maxEntries: 10, ttlMs: () => 1000, now: () => clock });
    expect(two).toBe(one);
    await one.getMany(["a"], makeLoader());
    const load = makeLoader();
    await two.getMany(["a"], load);
    expect(load).not.toHaveBeenCalled();
  });
});
