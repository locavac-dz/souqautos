import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

// Lot 129 — le fichier .github/workflows/ci.yml ne peut pas être exécuté ici (pas de serveur distant).
// Ces tests en vérifient tout ce qu'on peut vérifier sans lui : il est lisible, il ne lance que des
// commandes qui existent, ses étapes sont dans le bon ordre, et ses valeurs sont cohérentes avec les
// garde-fous du projet (base de test, version de Node, verrou des dépendances).
const require = createRequire(import.meta.url);
const yaml = require("js-yaml") as { load(text: string): unknown };

const APP = path.resolve(__dirname, "..");
const WORKFLOW = path.resolve(APP, "../.github/workflows/ci.yml");
const pkg = JSON.parse(readFileSync(path.join(APP, "package.json"), "utf8")) as { scripts: Record<string, string> };

type Step = { name?: string; uses?: string; run?: string; if?: string; with?: Record<string, string> };
type Job = { needs?: string; "runs-on": string; services?: Record<string, { image: string; options?: string; env?: Record<string, string> }>; steps: Step[]; "timeout-minutes"?: number };
type Workflow = { on: unknown; permissions?: Record<string, string>; env: Record<string, string>; defaults?: { run?: { "working-directory"?: string } }; jobs: Record<string, Job> };

const raw = readFileSync(WORKFLOW, "utf8");
const wf = yaml.load(raw) as Workflow;
const allSteps = Object.values(wf.jobs).flatMap((j) => j.steps);
const runs = allSteps.map((s) => s.run ?? "").filter(Boolean);
const indexOfRun = (job: string, fragment: string) => wf.jobs[job].steps.findIndex((s) => (s.run ?? "").includes(fragment));

describe("workflow CI — structure", () => {
  it("is valid YAML with the three expected jobs, each waiting for the previous", () => {
    expect(Object.keys(wf.jobs)).toEqual(["checks", "e2e", "docker"]);
    expect(wf.jobs.e2e.needs).toBe("checks");
    expect(wf.jobs.docker.needs).toBe("checks");
  });

  it("runs on pushes to the main branches and on every pull request", () => {
    const on = wf.on as { push?: { branches?: string[] }; pull_request?: unknown };
    expect(on.push?.branches).toEqual(expect.arrayContaining(["main", "master"]));
    expect("pull_request" in on).toBe(true);
  });

  it("works from the app/ folder and asks for read-only repository access", () => {
    expect(wf.defaults?.run?.["working-directory"]).toBe("app");
    expect(wf.permissions).toEqual({ contents: "read" });
    expect(existsSync(path.join(APP, "package-lock.json"))).toBe(true);
    for (const [name, job] of Object.entries(wf.jobs)) {
      const setup = job.steps.find((s) => s.uses?.startsWith("actions/setup-node"));
      if (!setup) continue; // le job docker n'installe pas Node (il utilise Buildx)
      expect(setup?.with?.["cache-dependency-path"], name).toBe("app/package-lock.json");
    }
  });

  it("pins every action to a major version, never to a moving branch", () => {
    for (const step of allSteps.filter((s) => s.uses)) expect(step.uses, step.uses).toMatch(/@v\d+$/);
  });

  it("gives every job a timeout, so a hung run cannot burn hours", () => {
    for (const [name, job] of Object.entries(wf.jobs)) expect(job["timeout-minutes"], name).toBeGreaterThan(0);
  });

  it("installs from the lockfile exactly (npm ci), never npm install", () => {
    expect(runs.some((r) => r.trim() === "npm ci")).toBe(true);
    expect(runs.some((r) => /npm install(\s|$)/.test(r))).toBe(false);
  });
});

describe("workflow CI — commands", () => {
  it("only runs npm scripts that exist in package.json", () => {
    const wanted = runs.flatMap((r) => [...r.matchAll(/npm run ([\w:.-]+)/g)].map((m) => m[1]));
    expect(wanted.length).toBeGreaterThan(2);
    for (const name of wanted) expect(pkg.scripts[name], `npm run ${name}`).toBeTruthy();
    if (runs.some((r) => /\bnpm test\b/.test(r))) expect(pkg.scripts.test).toBeTruthy();
  });

  it("generates the database client before type-checking (the types come from it)", () => {
    expect(indexOfRun("checks", "prisma generate")).toBeGreaterThan(-1);
    expect(indexOfRun("checks", "prisma generate")).toBeLessThan(indexOfRun("checks", "tsc --noEmit"));
  });

  it("applies the migrations to an empty database BEFORE comparing them with the schema", () => {
    expect(indexOfRun("checks", "migrate deploy")).toBeGreaterThan(-1);
    expect(indexOfRun("checks", "migrate deploy")).toBeLessThan(indexOfRun("checks", "check-schema-drift"));
    // L'écart est contrôlé par scripts/check-schema-drift.ts, qui ne tolère que les index pg_trgm conditionnels.
    const drift = readFileSync(path.join(APP, "scripts/check-schema-drift.ts"), "utf8");
    expect(drift).toContain("--from-migrations");
    expect(drift).toContain("--shadow-database-url");
    expect(drift).toContain("--script");
    expect(drift).toContain("process.exit(1)"); // sans lui, un écart inattendu ne ferait pas échouer l'étape
  });

  it("creates the shadow and end-to-end databases before using them", () => {
    expect(indexOfRun("checks", "CREATE DATABASE souq_auto_shadow")).toBeLessThan(indexOfRun("checks", "check-schema-drift"));
    expect(indexOfRun("e2e", "CREATE DATABASE souq_auto_e2e")).toBeLessThan(indexOfRun("e2e", "npm run test:e2e"));
  });

  it("installs the browser before the end-to-end tests, and both end-to-end suites run", () => {
    expect(indexOfRun("e2e", "playwright install")).toBeLessThan(indexOfRun("e2e", "npm run test:e2e"));
    expect(runs.some((r) => r.includes("npm run test:e2e:pwa"))).toBe(true);
  });

  it("splits the end-to-end suite into shards, so no development server lives long enough to leak", () => {
    // Mesuré en CI : le serveur de développement de test fuit ~0,2 Go/min ; Next.js le redémarre vers 20-25 min (requêtes
    // coupées, instabilités) et, sans ce garde-fou, il plante par manque de mémoire vers 32 min. Chaque tranche doit rester courte.
    const job = wf.jobs.e2e as Job & { strategy?: { "fail-fast"?: boolean; matrix?: { include?: { suite: string; shard: string }[] } } };
    const entries = job.strategy?.matrix?.include ?? [];
    const principal = entries.filter((e) => e.suite === "principale");
    expect(principal.length, "au moins 3 tranches de la suite principale").toBeGreaterThanOrEqual(3);
    expect(entries.some((e) => e.suite === "production")).toBe(true);
    expect(job.strategy?.["fail-fast"], "une tranche en échec ne doit pas interrompre les autres").toBe(false);
    // Les tranches sont `i/N` avec le même N, et couvrent 1..N exactement une fois.
    const shards = principal.map((e) => e.shard.split("/").map(Number));
    const total = shards[0][1];
    expect(shards.every(([, n]) => n === total)).toBe(true);
    expect(shards.map(([i]) => i).sort((a, b) => a - b)).toEqual(Array.from({ length: total }, (_, i) => i + 1));
    // La commande passe bien la tranche à Playwright.
    expect(runs.some((r) => r.includes("npm run test:e2e -- --shard=${{ matrix.shard }}"))).toBe(true);
    // Un délai de tranche court : un serveur bloqué ne doit pas brûler une heure.
    expect(job["timeout-minutes"]).toBeLessThanOrEqual(45);
  });

  it("keeps the traces when the end-to-end tests fail", () => {
    const upload = wf.jobs.e2e.steps.find((s) => s.uses?.startsWith("actions/upload-artifact"));
    expect(upload?.if).toBe("failure()");
  });

  it("gives the encryption key a value that is generated at run time, never written in the file", () => {
    expect(raw).not.toMatch(/ENCRYPTION_KEY:\s*\S/); // pas de valeur figée dans le fichier
    expect(runs.some((r) => r.includes("openssl rand -base64 32") && r.includes("ENCRYPTION_KEY"))).toBe(true);
  });
});

describe("workflow CI — coherence with the project", () => {
  it("uses the same PostgreSQL major version as the documented development database, with a health check", () => {
    for (const [name, job] of Object.entries(wf.jobs).filter(([, j]) => j.services)) {
      const pg = job.services!.postgres;
      expect(pg.image, name).toBe("postgres:17");
      expect(pg.options, name).toContain("--health-cmd");
    }
    expect(readFileSync(path.join(APP, "README.md"), "utf8")).toMatch(/\(17 en dev/);
  });

  it("points the tests at a database the reset script accepts: name ending in _e2e, different from the main one", () => {
    const e2e = new URL(wf.env.E2E_DATABASE_URL);
    const main = new URL(wf.env.DATABASE_URL);
    expect(e2e.pathname.endsWith("_e2e")).toBe(true);
    expect(wf.env.E2E_DATABASE_URL).not.toBe(wf.env.DATABASE_URL);
    expect(e2e.host).toBe(main.host);
    expect(new URL(wf.env.SHADOW_DATABASE_URL).pathname).not.toBe(main.pathname);
  });

  it("uses a Node version that Next.js supports, and an https-less local site address for the tests", () => {
    expect(Number(wf.env.NODE_VERSION)).toBeGreaterThanOrEqual(20);
    expect(wf.env.NEXT_PUBLIC_SITE_URL).toBe("http://localhost:5185"); // le port de playwright.config.ts
    expect(readFileSync(path.join(APP, "playwright.config.ts"), "utf8")).toContain("const PORT = 5185");
  });

  it("gives the site a signing secret long enough for its own start-up check", () => {
    expect(wf.env.JWT_SECRET.length).toBeGreaterThanOrEqual(32);
  });

  it("does not need any repository secret", () => {
    expect(raw).not.toMatch(/\$\{\{\s*secrets\./);
  });
});

describe("scripts d'installation des dépendances (npm ≥ 11)", () => {
  // npm 11 signale (et bloquera dans une version future) les dépendances qui lancent du code à
  // l'installation sans validation. Prisma, esbuild, SWC… en ont besoin : leur approbation est écrite dans
  // package.json. Une entrée épinglée à une ancienne version ne couvrirait plus rien après une mise à jour.
  const full = JSON.parse(readFileSync(path.join(APP, "package.json"), "utf8")) as { allowScripts?: Record<string, boolean> };
  const lock = JSON.parse(readFileSync(path.join(APP, "package-lock.json"), "utf8")) as { packages: Record<string, { version: string }> };

  it("approves the install scripts that the build really needs", () => {
    const names = Object.keys(full.allowScripts ?? {}).map((k) => k.replace(/@[^@/]+$/, ""));
    expect(names).toEqual(expect.arrayContaining(["prisma", "@prisma/client", "@prisma/engines", "esbuild"]));
  });

  it("pins each approval to the version that the lockfile installs", () => {
    for (const [entry, allowed] of Object.entries(full.allowScripts ?? {})) {
      expect(allowed, entry).toBe(true);
      const [, name, version] = entry.match(/^(.+)@([^@]+)$/) ?? [];
      expect(lock.packages[`node_modules/${name}`]?.version, entry).toBe(version);
    }
  });
});

describe("npm run verify", () => {
  const verify = readFileSync(path.join(APP, "scripts/verify.mjs"), "utf8");

  it("runs the same checks as the CI, using scripts that exist", () => {
    expect(pkg.scripts.verify).toBe("node scripts/verify.mjs");
    for (const [, name] of verify.matchAll(/npm run ([\w:.-]+)/g)) expect(pkg.scripts[name], `npm run ${name}`).toBeTruthy();
    expect(verify).toContain("tsc --noEmit");
    expect(verify).toContain("check-schema-drift"); // le même contrôle d'écart que la CI
  });

  it("never loads the whole .env into the tests' environment (they assume no Redis, as in CI)", () => {
    expect(verify).not.toContain("loadEnvFile");
    expect(verify).toMatch(/parseEnv\(.*\)\.SHADOW_DATABASE_URL/);
  });

  it("stops at the first failure unless asked to keep going, and exits with an error code", () => {
    expect(verify).toContain("keep-going");
    expect(verify).toContain("process.exit(failed.length ? 1 : 0)");
  });
});
