// Lot 137 — TEST DE CHARGE : `npm run load:test [-- options]`
//
//   --start                 compile (si besoin), démarre le site en PRODUCTION sur la base de charge (port 5192), le contrôle, l'arrête
//   --url <adresse>         cible un site déjà lancé (sans --start) ; défaut : http://localhost:5192
//   --scenario a,b,…        scénarios à jouer (défaut : tous) ; « navigation » = un mélange réaliste de visites
//   --concurrency 1,10,50   nombre de visiteurs simultanés ; plusieurs valeurs = une montée en charge (défaut : 10)
//   --duration 15           secondes de mesure par scénario et par palier (défaut : 15), précédées de --warmup 3 secondes
//   --budget <fichier>      limites par scénario (défaut : scripts/load-budget.json s'il existe) ; dépassement = code de sortie 1
//   --json <fichier>        écrit aussi les résultats en JSON
//   --rebuild               force la compilation (avec --start)
//
// Chaque « visiteur » enchaîne les requêtes sans pause (boucle fermée) : c'est plus sévère qu'un vrai visiteur, qui lit entre
// deux pages. Le nombre de visiteurs simultanés qu'on peut servir est donc BIEN supérieur au nombre de visiteurs réels
// simultanés : à ~10 requêtes/s de capacité, on sert confortablement plusieurs centaines de personnes qui naviguent.
//
// LIMITES À CONNAÎTRE : le générateur tourne sur LA MÊME machine que le serveur et la base, donc leur prend du processeur ;
// aucune latence réseau ; aucun chargement d'images ni de scripts (seulement les pages) ; Redis absent (limites en mémoire).
// Les chiffres valent pour CETTE machine et comparent avant/après une modification, pas un serveur de production.

import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { checkBudget, summarize } from "./load-stats.mjs";
import { getLoadDatabaseUrl } from "./load-database";

const APP = path.resolve(__dirname, "..");
const PORT = 5192;

const arg = (name: string) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const has = (name: string) => process.argv.includes(name);

type Context = { listingIds: string[]; sellerId: string };
type Scenario = { description: string; paths: (context: Context) => string[] };

const pick = <T,>(items: T[], n: number) => items.slice(0, n);
export const SCENARIOS: Record<string, Scenario> = {
  accueil: { description: "page d'accueil", paths: () => ["/fr"] },
  recherche: { description: "recherche sans filtre (tri récent)", paths: () => ["/fr/recherche", "/fr/recherche?page=2", "/fr/recherche?page=3"] },
  "recherche-filtres": {
    description: "recherche filtrée (catégorie, wilaya, carburant, prix, tri)",
    paths: () => [
      "/fr/recherche?category=VOITURE&wilayaId=16&fuelType=DIESEL&priceMax=2500000&sort=price_asc",
      "/fr/recherche?category=VOITURE&brandId=1&gearbox=AUTOMATIQUE&yearMin=2018&sort=price_desc",
      "/fr/recherche?wilayaId=31&priceMin=500000&priceMax=1500000&mileageMax=100000",
    ],
  },
  "recherche-texte": { description: "recherche par mot (ILIKE sur 7 colonnes)", paths: () => ["/fr/recherche?q=clio", "/fr/recherche?q=golf", "/fr/recherche?q=alger", "/fr/recherche?q=diesel"] },
  "recherche-profonde": { description: "pagination profonde", paths: () => ["/fr/recherche?page=100", "/fr/recherche?page=500", "/fr/recherche?page=1000"] },
  annonce: { description: "fiche d'une annonce", paths: (c) => pick(c.listingIds, 40).map((id) => `/fr/annonce/${id}`) },
  "page-modele": { description: "page d'un modèle très courant (Renault Clio)", paths: () => ["/fr/voitures/renault/clio"] },
  vendeur: { description: "page du plus gros vendeur (des milliers d'annonces)", paths: (c) => [`/fr/vendeur/${c.sellerId}`] },
  sitemap: { description: "plan du site (lu par les moteurs de recherche)", paths: () => ["/sitemap.xml"] },
  sante: { description: "contrôle de santé", paths: () => ["/api/health"] },
};
// Mélange plausible d'une heure de trafic : beaucoup de recherches et de fiches, un peu d'accueil et de pages modèle.
const NAVIGATION_MIX: [string, number][] = [["accueil", 15], ["recherche", 25], ["recherche-filtres", 20], ["recherche-texte", 10], ["annonce", 25], ["page-modele", 5]];

type Budget = Record<string, { p95Ms?: number; maxErrorRate?: number; minRps?: number }>;

async function discover(base: string): Promise<Context> {
  const listingIds = new Set<string>();
  for (const page of [1, 2, 3, 4]) {
    const html = await (await fetch(`${base}/fr/recherche${page > 1 ? `?page=${page}` : ""}`)).text();
    for (const match of html.matchAll(/\/annonce\/([A-Za-z0-9_-]+)/g)) listingIds.add(match[1]);
  }
  if (listingIds.size === 0) throw new Error("Aucune annonce trouvée sur /fr/recherche : la base de charge est-elle remplie (npm run load:seed) ?");
  const first = [...listingIds][0];
  const seller = /\/vendeur\/([A-Za-z0-9_-]+)/.exec(await (await fetch(`${base}/fr/annonce/${first}`)).text());
  if (!seller) throw new Error("Aucun lien vendeur trouvé sur une fiche d'annonce.");
  return { listingIds: [...listingIds], sellerId: seller[1] };
}

async function hit(url: string): Promise<{ ms: number; ok: boolean; bytes: number }> {
  const started = performance.now();
  try {
    const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(20_000) });
    const body = await response.arrayBuffer();
    return { ms: performance.now() - started, ok: response.status === 200, bytes: body.byteLength };
  } catch {
    return { ms: performance.now() - started, ok: false, bytes: 0 };
  }
}

async function runPhase(urls: string[], concurrency: number, seconds: number) {
  const latencies: number[] = [];
  let errors = 0;
  let bytes = 0;
  const deadline = performance.now() + seconds * 1000;
  let cursor = Math.floor(Math.random() * urls.length);
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (performance.now() < deadline) {
        const result = await hit(urls[cursor++ % urls.length]);
        if (result.ok) {
          latencies.push(result.ms);
          bytes += result.bytes;
        } else errors += 1;
      }
    }),
  );
  return { latencies, errors, bytes };
}

function urlsFor(name: string, base: string, context: Context): string[] {
  if (name === "navigation") {
    // Chaque scénario apparaît autant de fois que son poids : les visiteurs tirent dans une liste pondérée.
    return NAVIGATION_MIX.flatMap(([scenario, weight]) => {
      const paths = SCENARIOS[scenario].paths(context);
      return Array.from({ length: weight }, (_, i) => `${base}${paths[i % paths.length]}`);
    });
  }
  return SCENARIOS[name].paths(context).map((p) => `${base}${p}`);
}

async function waitForHealth(base: string, seconds = 60) {
  for (let i = 0; i < seconds; i++) {
    try {
      if ((await fetch(`${base}/api/health`)).ok) return;
    } catch {
      /* pas encore prêt */
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Le site ne répond pas sur ${base}.`);
}

function startServer(): ChildProcess {
  const env = { ...process.env, DATABASE_URL: getLoadDatabaseUrl(), REDIS_URL: "", S3_BUCKET: "", NODE_ENV: "production" as const };
  const next = path.join(APP, "node_modules", "next", "dist", "bin", "next");
  if (has("--rebuild") || !existsSync(path.join(APP, ".next", "BUILD_ID"))) {
    console.log("Compilation de production…");
    const build = spawnSync(process.execPath, [next, "build"], { cwd: APP, env, stdio: "inherit" });
    if (build.status !== 0) throw new Error("La compilation a échoué.");
  }
  return spawn(process.execPath, [next, "start", "-p", String(PORT)], { cwd: APP, env, stdio: ["ignore", "ignore", "inherit"] });
}

async function main() {
  const start = has("--start");
  const base = (arg("--url") ?? `http://localhost:${PORT}`).replace(/\/$/, "");
  const wanted = (arg("--scenario") ?? [...Object.keys(SCENARIOS), "navigation"].join(",")).split(",").map((s) => s.trim());
  for (const name of wanted) if (name !== "navigation" && !SCENARIOS[name]) throw new Error(`Scénario inconnu : ${name}. Disponibles : ${Object.keys(SCENARIOS).join(", ")}, navigation`);
  const levels = (arg("--concurrency") ?? "10").split(",").map(Number);
  const duration = Number(arg("--duration") ?? 15);
  const warmup = Number(arg("--warmup") ?? 3);
  const budgetFile = arg("--budget") ?? path.join(APP, "scripts", "load-budget.json");
  const budget: Budget = existsSync(budgetFile) ? (JSON.parse(readFileSync(budgetFile, "utf8")) as Budget) : {};

  const server = start ? startServer() : null;
  try {
    await waitForHealth(base, start ? 90 : 10);
    const context = await discover(base);
    console.log(`Base : ${start ? getLoadDatabaseUrl().replace(/:[^:@/]*@/, ":***@") : "site déjà lancé"} — ${context.listingIds.length} fiches repérées, vendeur ${context.sellerId}`);
    console.log(`Palier(s) : ${levels.join(", ")} visiteur(s) simultané(s) · ${warmup} s d'échauffement + ${duration} s de mesure par scénario\n`);

    const results: { scenario: string; concurrency: number; summary: ReturnType<typeof summarize>; problems: string[] }[] = [];
    console.log(`${"scénario".padEnd(20)}${"visiteurs".padStart(9)}${"req/s".padStart(8)}${"p50".padStart(8)}${"p95".padStart(8)}${"p99".padStart(8)}${"max".padStart(8)}${"erreurs".padStart(9)}${"Ko/page".padStart(9)}`);
    for (const name of wanted) {
      const urls = urlsFor(name, base, context);
      for (const concurrency of levels) {
        await runPhase(urls, concurrency, warmup); // chauffe les caches (base, compilation des pages) : non mesuré
        const started = performance.now();
        const phase = await runPhase(urls, concurrency, duration);
        const summary = summarize({ ...phase, durationSeconds: (performance.now() - started) / 1000 });
        // Le budget d'un scénario ne s'applique qu'au palier PAR DÉFAUT (10 visiteurs) : les autres servent à voir la montée.
        const problems = concurrency === 10 && budget[name] ? checkBudget(summary, budget[name]) : [];
        results.push({ scenario: name, concurrency, summary, problems });
        console.log(
          `${name.padEnd(20)}${String(concurrency).padStart(9)}${String(summary.rps).padStart(8)}${String(summary.p50).padStart(8)}${String(summary.p95).padStart(8)}${String(summary.p99).padStart(8)}${String(summary.max).padStart(8)}${`${summary.errors}`.padStart(9)}${String(summary.avgKb).padStart(9)}${problems.length ? "  ✗ " + problems.join(" ; ") : ""}`,
        );
      }
    }
    console.log("\n(durées en millisecondes, mesurées de la demande à la réception complète de la page)");
    if (arg("--json")) writeFileSync(arg("--json")!, JSON.stringify({ at: new Date().toISOString(), levels, duration, results }, null, 2));
    const failed = results.filter((r) => r.problems.length > 0);
    if (failed.length > 0) {
      console.log(`\n✗ ${failed.length} scénario(s) hors budget : ${failed.map((r) => r.scenario).join(", ")}`);
      process.exitCode = 1;
    } else if (Object.keys(budget).length > 0) {
      console.log("\n✓ Tous les scénarios budgétés sont dans leur budget.");
    }
  } finally {
    server?.kill();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(2);
});
