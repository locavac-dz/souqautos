// Lot 137 — statistiques du test de charge (scripts/load-test.mjs). Pures : aucune requête, testées dans tests/load-stats.test.ts.

// Rang le plus proche (« nearest rank ») sur une liste TRIÉE : le percentile est une durée réellement observée, jamais une
// valeur interpolée qu'aucune requête n'a connue. p95 = « 95 % des requêtes ont été au moins aussi rapides ».
export function percentile(sortedAscending, p) {
  if (sortedAscending.length === 0) return 0;
  const rank = Math.ceil((p / 100) * sortedAscending.length);
  return sortedAscending[Math.min(sortedAscending.length, Math.max(1, rank)) - 1];
}

const round = (value, digits = 1) => Math.round(value * 10 ** digits) / 10 ** digits;

// latencies : durées (ms) des requêtes RÉUSSIES ; errors : nombre de requêtes en échec (réseau, expiration, statut ≥ 400).
// Les échecs ne sont jamais mélangés aux durées : une erreur immédiate (connexion refusée en 1 ms) ferait paraître le serveur
// rapide alors qu'il est en panne.
export function summarize({ latencies, errors, durationSeconds, bytes = 0 }) {
  const sorted = [...latencies].sort((a, b) => a - b);
  const requests = latencies.length + errors;
  return {
    requests,
    errors,
    errorRate: requests === 0 ? 0 : round(errors / requests, 4),
    rps: durationSeconds > 0 ? round(latencies.length / durationSeconds) : 0,
    p50: round(percentile(sorted, 50)),
    p95: round(percentile(sorted, 95)),
    p99: round(percentile(sorted, 99)),
    max: round(sorted.length ? sorted[sorted.length - 1] : 0),
    mean: round(sorted.length ? sorted.reduce((sum, v) => sum + v, 0) / sorted.length : 0),
    avgKb: latencies.length ? round(bytes / latencies.length / 1024) : 0,
  };
}

// budget : { p95Ms, maxErrorRate, minRps? }. Renvoie la liste des dépassements (vide = dans le budget).
export function checkBudget(summary, budget) {
  const problems = [];
  if (summary.requests === 0) return ["aucune requête n'a abouti"];
  if (summary.errorRate > (budget.maxErrorRate ?? 0)) problems.push(`${round(summary.errorRate * 100, 2)} % d'erreurs (budget ${round((budget.maxErrorRate ?? 0) * 100, 2)} %)`);
  if (budget.p95Ms !== undefined && summary.p95 > budget.p95Ms) problems.push(`p95 ${summary.p95} ms (budget ${budget.p95Ms} ms)`);
  if (budget.minRps !== undefined && summary.rps < budget.minRps) problems.push(`${summary.rps} requêtes/s (minimum ${budget.minRps})`);
  return problems;
}
