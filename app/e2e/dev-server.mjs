// Serveur de test des tests de bout en bout : `next dev` PRÉCHAUFFÉ.
//
// `next dev` compile chaque route à sa première visite. Quand une page en compile une pendant qu'une autre requête lit
// les manifestes, il répond 500 « Manifest file is empty » / « Unexpected end of JSON input » (course du mode
// développement, constatée en CI : elle a fait échouer des tests malgré deux reprises). On la supprime à la source :
// ce script démarre `next dev`, visite UNE FOIS et UNE PAR UNE toutes les routes (donc aucune compilation concurrente
// d'une requête de test), puis seulement ouvre le point de santé que Playwright attend (port HEALTH_PORT).
//
// E2E_WARMUP=0 désactive le préchauffage (démarrage direct, comme avant).
import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";

const PORT = Number(process.env.E2E_PORT ?? 5185);
const HEALTH_PORT = Number(process.env.E2E_HEALTH_PORT ?? 5190);
const ROOT = join(process.cwd(), "src", "app");
const PER_REQUEST_MS = 45_000;
const TOTAL_MS = 8 * 60_000;
// Routes à ne pas visiter : flux qui ne se terminent pas, retour de Google, tâche planifiée, déconnexion.
const SKIP = /(^|\/)(stream|cron|logout|callback|start)(\/|$)/;

// Les routes de l'application : un dossier avec page.tsx ou route.ts. [locale] et les groupes (x) n'ont pas de segment d'URL
// (la langue par défaut n'est pas préfixée) ; un paramètre dynamique [id] reçoit « 1 » (la route est compilée, la réponse
// importe peu : 404, 400 ou 401).
function routes(dir = ROOT, segments = []) {
  const found = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  if (entries.some((e) => e.isFile() && /^(page|route)\.tsx?$/.test(e.name))) {
    found.push("/" + segments.join("/"));
  }
  for (const e of entries) {
    if (!e.isDirectory() || e.name.startsWith("@") || e.name.startsWith("_")) continue;
    let segment = e.name;
    if (segment === "[locale]" || /^\(.*\)$/.test(segment)) segment = null;
    else if (/^\[\[?\.\.\./.test(segment) || /^\[.*\]$/.test(segment)) segment = "1";
    found.push(...routes(join(dir, e.name), segment === null ? segments : [...segments, segment]));
  }
  return found;
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function visit(path) {
  try {
    const response = await fetch(`http://localhost:${PORT}${path}`, {
      redirect: "manual",
      signal: AbortSignal.timeout(PER_REQUEST_MS),
    });
    await response.body?.cancel();
    return response.status;
  } catch {
    return "erreur";
  }
}

const child = spawn("npx", ["next", "dev", "--webpack", "-p", String(PORT)], {
  stdio: "inherit",
  shell: true,
  env: process.env,
});
child.on("exit", (code) => process.exit(code ?? 1));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));

async function warmUp() {
  while ((await visit("/api/health")) === "erreur") await wait(1000);
  if (process.env.E2E_WARMUP === "0") return;
  const start = Date.now();
  const list = [...new Set(routes())].filter((p) => !SKIP.test(p)).sort();
  let done = 0;
  for (const path of list) {
    if (Date.now() - start > TOTAL_MS) break;
    await visit(path);
    done += 1;
  }
  console.error(`[préchauffage] ${done}/${list.length} routes visitées en ${Math.round((Date.now() - start) / 1000)} s`);
}

await warmUp();
createServer((_, response) => response.end("ok")).listen(HEALTH_PORT);
