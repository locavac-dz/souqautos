import { describe, expect, it } from "vitest";
import { checkBudget, percentile, summarize } from "../scripts/load-stats.mjs";

describe("percentile (rang le plus proche)", () => {
  const values = Array.from({ length: 100 }, (_, i) => i + 1); // 1..100 déjà trié
  it("donne une durée réellement observée, jamais une valeur interpolée", () => {
    expect(percentile(values, 50)).toBe(50);
    expect(percentile(values, 95)).toBe(95);
    expect(percentile(values, 99)).toBe(99);
    expect(percentile(values, 100)).toBe(100);
    expect([3, 8, 20]).toContain(percentile([3, 8, 20], 90));
  });
  it("gère les bords : liste vide, une seule valeur, pourcentage 0", () => {
    expect(percentile([], 95)).toBe(0);
    expect(percentile([42], 95)).toBe(42);
    expect(percentile(values, 0)).toBe(1);
  });
  it("sur 20 mesures, le p95 est la 19e (pas la dernière)", () => {
    const twenty = Array.from({ length: 20 }, (_, i) => (i + 1) * 10);
    expect(percentile(twenty, 95)).toBe(190);
  });
});

describe("summarize", () => {
  it("calcule débit, percentiles, moyenne et poids moyen d'une page", () => {
    const s = summarize({ latencies: [10, 20, 30, 40, 1000], errors: 0, durationSeconds: 2, bytes: 5 * 2048 });
    expect(s).toMatchObject({ requests: 5, errors: 0, errorRate: 0, rps: 2.5, p50: 30, p95: 1000, max: 1000, mean: 220, avgKb: 2 });
  });
  it("ne mélange JAMAIS les échecs aux durées : une erreur immédiate ne rend pas le serveur rapide", () => {
    const s = summarize({ latencies: [100, 100], errors: 8, durationSeconds: 1 });
    expect(s.requests).toBe(10);
    expect(s.errorRate).toBe(0.8);
    expect(s.p50).toBe(100); // les 8 échecs à ~1 ms n'ont pas tiré la médiane vers le bas
  });
  it("ne plante pas quand tout a échoué ou qu'il n'y a rien", () => {
    expect(summarize({ latencies: [], errors: 5, durationSeconds: 3 })).toMatchObject({ requests: 5, errorRate: 1, rps: 0, p95: 0, avgKb: 0 });
    expect(summarize({ latencies: [], errors: 0, durationSeconds: 3 })).toMatchObject({ requests: 0, errorRate: 0 });
  });
});

describe("checkBudget", () => {
  const ok = summarize({ latencies: [100, 120, 140, 160, 180], errors: 0, durationSeconds: 1 });
  it("accepte ce qui est dans le budget", () => {
    expect(checkBudget(ok, { p95Ms: 200, maxErrorRate: 0 })).toEqual([]);
  });
  it("signale chaque dépassement avec les deux nombres", () => {
    const slow = checkBudget(ok, { p95Ms: 150, maxErrorRate: 0 });
    expect(slow).toHaveLength(1);
    expect(slow[0]).toContain("180");
    expect(slow[0]).toContain("150");
    const failing = summarize({ latencies: [100], errors: 1, durationSeconds: 1 });
    expect(checkBudget(failing, { p95Ms: 500, maxErrorRate: 0 })[0]).toContain("50 %");
  });
  it("tolère les erreurs que le budget autorise, exige un débit minimal si demandé", () => {
    const some = summarize({ latencies: Array(99).fill(50), errors: 1, durationSeconds: 1 });
    expect(checkBudget(some, { maxErrorRate: 0.02 })).toEqual([]);
    expect(checkBudget(ok, { minRps: 100 })[0]).toContain("minimum 100");
  });
  it("un scénario où plus rien n'a abouti est toujours hors budget", () => {
    expect(checkBudget(summarize({ latencies: [], errors: 0, durationSeconds: 1 }), { p95Ms: 1000 })).toEqual(["aucune requête n'a abouti"]);
  });
});
