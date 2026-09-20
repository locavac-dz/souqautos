import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { REFERENCE_MAX_ENTRIES, REFERENCE_TTL_MS, cachedReference, invalidateReferenceData, resetReferenceDataForTests } from "@/lib/reference-data";

let clock = 1_000_000;
const now = () => clock;

beforeEach(() => {
  resetReferenceDataForTests();
  clock = 1_000_000;
});

describe("cachedReference", () => {
  it("ne charge qu'une fois tant que la valeur est fraîche, puis recharge après la durée de vie", async () => {
    const load = vi.fn().mockResolvedValueOnce([{ id: 1 }]).mockResolvedValueOnce([{ id: 2 }]);
    expect(await cachedReference("k", load, { now })).toEqual([{ id: 1 }]);
    clock += REFERENCE_TTL_MS - 1;
    expect(await cachedReference("k", load, { now })).toEqual([{ id: 1 }]);
    expect(load).toHaveBeenCalledTimes(1);
    clock += 2;
    expect(await cachedReference("k", load, { now })).toEqual([{ id: 2 }]);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("respecte une durée de vie propre à l'appel", async () => {
    const load = vi.fn().mockResolvedValue("x");
    await cachedReference("k", load, { now, ttlMs: 1000 });
    clock += 1001;
    await cachedReference("k", load, { now, ttlMs: 1000 });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("regroupe les chargements simultanés en un seul (pas de ruée sur la base à l'expiration)", async () => {
    let release!: (v: string) => void;
    const load = vi.fn(() => new Promise<string>((resolve) => (release = resolve)));
    const calls = [cachedReference("k", load, { now }), cachedReference("k", load, { now }), cachedReference("k", load, { now })];
    release("valeur");
    expect(await Promise.all(calls)).toEqual(["valeur", "valeur", "valeur"]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("ne met JAMAIS un échec en cache : l'appel suivant réessaie", async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error("base indisponible")).mockResolvedValueOnce("ok");
    await expect(cachedReference("k", load, { now })).rejects.toThrow("base indisponible");
    expect(await cachedReference("k", load, { now })).toBe("ok");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("garde chaque clé indépendante", async () => {
    const a = vi.fn().mockResolvedValue("A");
    const b = vi.fn().mockResolvedValue("B");
    expect(await cachedReference("a", a, { now })).toBe("A");
    expect(await cachedReference("b", b, { now })).toBe("B");
    expect(await cachedReference("a", a, { now })).toBe("A");
    expect(a).toHaveBeenCalledTimes(1);
  });

  it("gèle la valeur, y compris en profondeur : elle est partagée, personne ne doit la modifier", async () => {
    const value = await cachedReference("k", async () => [{ id: 1, models: [{ name: "Clio" }], createdAt: new Date() }], { now });
    expect(() => (value as { id: number }[]).push({ id: 2 })).toThrow(TypeError);
    expect(() => ((value[0] as { models: { name: string }[] }).models[0].name = "x")).toThrow(TypeError);
    expect(() => (value as { id: number }[]).sort()).not.toThrow(); // trier un tableau d'un seul élément ne change rien…
    const two = await cachedReference("deux", async () => [{ n: 2 }, { n: 1 }], { now });
    expect(() => two.sort((x, y) => x.n - y.n)).toThrow(TypeError); // …mais un vrai tri sur place échoue bruyamment
  });

  it("renvoie le MÊME objet aux visites suivantes (rien n'est recopié)", async () => {
    const first = await cachedReference("k", async () => [{ id: 1 }], { now });
    expect(await cachedReference("k", async () => [], { now })).toBe(first);
  });
});

describe("plafond d'entrées", () => {
  it("retire la plus ancienne quand il y a trop d'entrées : la mémoire ne grossit pas avec le catalogue", async () => {
    const loads: number[] = [];
    const load = (i: number) => async () => {
      loads[i] = (loads[i] ?? 0) + 1;
      return i;
    };
    for (let i = 0; i <= REFERENCE_MAX_ENTRIES; i++) await cachedReference(`k${i}`, load(i), { now });
    // k0 (la plus ancienne) a été retirée : elle se recharge ; la dernière est encore là.
    await cachedReference("k0", load(0), { now });
    expect(loads[0]).toBe(2);
    await cachedReference(`k${REFERENCE_MAX_ENTRIES}`, load(REFERENCE_MAX_ENTRIES), { now });
    expect(loads[REFERENCE_MAX_ENTRIES]).toBe(1);
  });

  it("une entrée rafraîchie repasse en dernier : ce sont les moins récemment chargées qui partent d'abord", async () => {
    const a = vi.fn().mockResolvedValue("A");
    await cachedReference("a", a, { now, ttlMs: 10 });
    for (let i = 0; i < REFERENCE_MAX_ENTRIES - 1; i++) await cachedReference(`x${i}`, async () => i, { now, ttlMs: 10_000_000 });
    clock += 11; // « a » expire ; son rechargement la remet en fin de file
    await cachedReference("a", a, { now });
    await cachedReference("nouvelle", async () => 0, { now }); // une entrée de trop : la plus ancienne (x0) part, pas « a »
    await cachedReference("a", a, { now });
    expect(a).toHaveBeenCalledTimes(2);
  });
});

describe("invalidateReferenceData", () => {
  it("force le rechargement immédiat (changement du catalogue par l'administration)", async () => {
    const load = vi.fn().mockResolvedValueOnce("avant").mockResolvedValueOnce("après");
    expect(await cachedReference("k", load, { now })).toBe("avant");
    invalidateReferenceData();
    expect(await cachedReference("k", load, { now })).toBe("après");
  });

  it("ne garde pas le résultat d'un chargement commencé AVANT l'invalidation (il peut être périmé)", async () => {
    let release!: (v: string) => void;
    const slow = vi.fn(() => new Promise<string>((resolve) => (release = resolve)));
    const pending = cachedReference("k", slow, { now });
    invalidateReferenceData(); // pendant que le chargement est en cours
    release("périmé");
    expect(await pending).toBe("périmé"); // rendu à celui qui l'attendait…
    const fresh = vi.fn().mockResolvedValue("frais");
    expect(await cachedReference("k", fresh, { now })).toBe("frais"); // …mais jamais gardé
    expect(fresh).toHaveBeenCalledTimes(1);
  });
});
