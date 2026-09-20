// Lot 118 — utilitaires communs aux scripts de sauvegarde et de test de restauration.
// Multiplateforme (Windows, Linux) : aucun shell, aucune dépendance npm.

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

// Lit le fichier d'environnement (`--env chemin`, sinon `.env`) dans process.env.
export function loadEnv(argv = process.argv) {
  const flag = argv.indexOf("--env");
  const file = flag >= 0 ? argv[flag + 1] : ".env";
  const resolved = path.resolve(process.cwd(), file ?? ".env");
  if (!existsSync(resolved)) fail(`Fichier de configuration introuvable : ${resolved}`, 2);
  process.loadEnvFile(resolved);
  return resolved;
}

export function argValue(name, fallback, argv = process.argv) {
  const index = argv.indexOf(name);
  return index >= 0 && argv[index + 1] ? argv[index + 1] : fallback;
}

export function fail(message, code = 1) {
  console.error(message);
  process.exit(code);
}

// Décompose DATABASE_URL. Le mot de passe n'est jamais affiché : il est transmis
// aux outils PostgreSQL par la variable d'environnement PGPASSWORD.
export function parseDatabaseUrl(raw = process.env.DATABASE_URL) {
  if (!raw) fail("DATABASE_URL n'est pas défini.", 2);
  let url;
  try {
    url = new URL(raw);
  } catch {
    fail("DATABASE_URL n'est pas une adresse valide.", 2);
  }
  return {
    host: url.hostname,
    port: url.port || "5432",
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, "")),
  };
}

// Trouve un outil PostgreSQL : PG_BIN, puis le PATH, puis les emplacements
// d'installation habituels de Windows (version la plus récente d'abord).
export function findPgTool(name) {
  const exe = process.platform === "win32" ? `${name}.exe` : name;
  const dirs = [];
  if (process.env.PG_BIN) dirs.push(process.env.PG_BIN);
  dirs.push(...(process.env.PATH ?? "").split(path.delimiter).filter(Boolean));
  if (process.platform === "win32") {
    const root = "C:/Program Files/PostgreSQL";
    if (existsSync(root)) {
      const versions = readdirSync(root).sort((a, b) => Number(b) - Number(a));
      dirs.push(...versions.map((v) => path.join(root, v, "bin")));
    }
  } else {
    dirs.push("/usr/bin", "/usr/local/bin", ...["17", "16", "15", "14"].map((v) => `/usr/lib/postgresql/${v}/bin`));
  }
  for (const dir of dirs) {
    const candidate = path.join(dir, exe);
    if (existsSync(candidate)) return candidate;
  }
  fail(`Outil PostgreSQL « ${name} » introuvable. Installer les outils clients PostgreSQL ou définir PG_BIN (dossier bin).`, 2);
}

export function connectionArgs(db) {
  return ["-h", db.host, "-p", db.port, "-U", db.user];
}

// Exécute un outil PostgreSQL et renvoie { status, stdout, stderr }.
export function runPg(tool, args, db, options = {}) {
  const result = spawnSync(findPgTool(tool), args, {
    // Sous Windows, les messages des outils PostgreSQL sont écrits dans la page de code de la console (pas en UTF-8) : lus
    // ici, les accents deviennent « � », y compris dans les courriels du veilleur. Messages en anglais (ASCII) : lisibles partout.
    env: { ...process.env, PGPASSWORD: db.password, ...(process.platform === "win32" ? { LC_MESSAGES: "C" } : {}) },
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    ...options,
  });
  if (result.error) fail(`Échec de ${tool} : ${result.error.message}`, 2);
  return { status: result.status ?? 1, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

export function timestamp(date = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
}

export function humanSize(bytes) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}
