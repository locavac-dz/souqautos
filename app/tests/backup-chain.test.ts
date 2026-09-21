import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, statfsSync, utimesSync, writeFileSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Git Bash's tar cannot parse Windows paths like C:\... (interprets "C" as a hostname).
const toPosix = (p: string) =>
  process.platform === "win32" ? p.replace(/^([A-Za-z]):[/\\]/, (_, d) => `/${d.toLowerCase()}/`).replace(/\\/g, "/") : p;
import { evaluateOps, isDumpName, type OpsFacts, type OpsStatus } from "@/lib/ops-status";

// Lot 136 — la CHAÎNE réelle, sans simulation : vraie sauvegarde (pg_dump), vraie restauration dans une base temporaire, vrai
// veilleur. Ce que ces tests prouvent, et qu'aucun test unitaire ne peut prouver : que les scripts écrivent bien le journal
// d'état que le veilleur lit, qu'un échec est enregistré SANS laisser d'archive incomplète, et que le veilleur passe du vert
// au rouge quand la sauvegarde casse.
//
// Utilise la base de développement (lecture seule : pg_dump ne la modifie pas ; la restauration se fait dans une base
// temporaire « <base>_restorecheck », supprimée ensuite). Se SAUTE si la configuration, la base ou les outils PostgreSQL manquent.

const APP = process.cwd();
const ENV_FILE = path.join(APP, ".env");

function databaseUrl(): string | null {
  if (!existsSync(ENV_FILE)) return process.env.DATABASE_URL ?? null;
  const line = readFileSync(ENV_FILE, "utf8").split(/\r?\n/).find((l) => l.startsWith("DATABASE_URL="));
  return line ? line.slice("DATABASE_URL=".length).replace(/^["']|["']$/g, "") : null;
}

async function reachable(url: string): Promise<boolean> {
  try {
    const { hostname, port } = new URL(url);
    return await new Promise((resolve) => {
      const socket = net.connect({ host: hostname, port: Number(port || 5432), timeout: 1500 });
      socket.on("connect", () => (socket.destroy(), resolve(true)));
      socket.on("error", () => resolve(false));
      socket.on("timeout", () => (socket.destroy(), resolve(false)));
    });
  } catch {
    return false;
  }
}

const node = (script: string, args: string[]) => spawnSync(process.execPath, [path.join(APP, "scripts", script), ...args], { cwd: APP, encoding: "utf8", timeout: 120_000 });
const tsx = (script: string, args: string[]) => spawnSync(process.execPath, [path.join(APP, "node_modules", "tsx", "dist", "cli.mjs"), path.join(APP, "scripts", script), ...args], { cwd: APP, encoding: "utf8", timeout: 120_000 });

function readFacts(dir: string, now = Date.now()): OpsFacts {
  const statusFile = path.join(dir, "status.json");
  return {
    now,
    status: existsSync(statusFile) ? (JSON.parse(readFileSync(statusFile, "utf8")) as OpsStatus) : null,
    dumps: readdirSync(dir).filter(isDumpName).map((name) => ({ name, sizeBytes: statSync(path.join(dir, name)).size, mtimeMs: statSync(path.join(dir, name)).mtimeMs })),
    freeBytes: Number(statfsSync(dir).bavail) * Number(statfsSync(dir).bsize),
    health: null,
  };
}
const dumpsIn = (dir: string) => readdirSync(dir).filter(isDumpName);
const levels = (facts: OpsFacts) => Object.fromEntries(evaluateOps(facts).map((c) => [c.id, c.level]));

let ready = false;
let dir = "";
let brokenEnv = "";

beforeAll(async () => {
  const url = databaseUrl();
  ready = Boolean(url) && (await reachable(url!));
  if (!ready) return;
  dir = mkdtempSync(path.join(os.tmpdir(), "souq-backup-chain-"));
  // Même compte, base qui n'existe pas : provoque un vrai échec de pg_dump.
  const broken = new URL(url!);
  broken.pathname = "/souq_base_inexistante_lot136";
  brokenEnv = path.join(dir, "panne.env");
  writeFileSync(brokenEnv, `DATABASE_URL="${broken.toString()}"\n`);
});
afterAll(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

describe("la chaîne sauvegarde → restauration → veilleur (vrais outils PostgreSQL)", () => {
  it("une vraie sauvegarde écrit l'archive ET le journal d'état, et le veilleur la juge saine", (ctx) => {
    if (!ready) return ctx.skip();
    const backup = node("backup-db.mjs", ["--out", dir]);
    if (backup.status === 2) return ctx.skip(); // outils PostgreSQL absents ou configuration incomplète
    expect(backup.status, backup.stderr + backup.stdout).toBe(0);

    const status = JSON.parse(readFileSync(path.join(dir, "status.json"), "utf8")) as OpsStatus;
    const success = status.backup!.lastSuccess!;
    expect(dumpsIn(dir)).toEqual([success.file]);
    expect(success.sizeBytes).toBe(statSync(path.join(dir, success.file!)).size);
    expect(success.sizeBytes).toBeGreaterThan(10_000);
    expect(success.objects).toBeGreaterThan(50);
    expect(success.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(Math.abs(Date.now() - Date.parse(success.at))).toBeLessThan(120_000);
    expect(status.backup!.lastFailure).toBeUndefined();

    expect(levels(readFacts(dir))).toMatchObject({ "backup-recent": "ok", "backup-size": "ok", "backup-disk": "ok", "restore-check": "warning" }); // pas encore restaurée
  }, 120_000);

  it("le test de restauration est enregistré, et le veilleur passe au vert complet", (ctx) => {
    if (!ready || dumpsIn(dir).length === 0) return ctx.skip();
    const restore = node("restore-check.mjs", ["--out", dir]);
    expect(restore.status, restore.stderr + restore.stdout).toBe(0);
    expect(restore.stdout).toContain("RESTAURATION VÉRIFIÉE");
    const status = JSON.parse(readFileSync(path.join(dir, "status.json"), "utf8")) as OpsStatus;
    expect(status.restoreCheck!.lastSuccess).toMatchObject({ file: dumpsIn(dir)[0], tables: 15 });
    expect(status.backup!.lastSuccess).toBeDefined(); // le journal de sauvegarde n'a pas été écrasé
    expect(Object.values(levels(readFacts(dir))).every((l) => l === "ok")).toBe(true);
  }, 120_000);

  it("le veilleur en ligne de commande rend 0 quand tout va bien", (ctx) => {
    if (!ready || dumpsIn(dir).length === 0) return ctx.skip();
    const check = tsx("ops-check.ts", ["--out", dir, "--no-health", "--env", path.join(dir, "panne.env")]);
    expect(check.status, check.stdout + check.stderr).toBe(0);
    expect(check.stdout).toContain("0 problème(s)");
  }, 120_000);

  it("une sauvegarde qui ÉCHOUE est enregistrée, sans laisser d'archive incomplète, et garde la dernière réussite", (ctx) => {
    if (!ready || dumpsIn(dir).length === 0) return ctx.skip();
    const before = dumpsIn(dir);
    const failed = node("backup-db.mjs", ["--out", dir, "--env", brokenEnv]);
    expect(failed.status).not.toBe(0);

    expect(dumpsIn(dir)).toEqual(before); // aucun fichier partiel pris pour une sauvegarde
    const status = JSON.parse(readFileSync(path.join(dir, "status.json"), "utf8")) as OpsStatus;
    expect(status.backup!.lastFailure!.reason).toMatch(/pg_dump a échoué.*souq_base_inexistante_lot136/);
    expect(status.backup!.lastSuccess!.file).toBe(before[0]); // la réussite précédente n'est pas perdue
    expect(evaluateOps(readFacts(dir)).find((c) => c.id === "backup-recent")).toMatchObject({ level: "error" });
  }, 120_000);

  it("le veilleur en ligne de commande rend 1 dans cet état, puis 0 dès qu'une sauvegarde réussit de nouveau", (ctx) => {
    if (!ready || dumpsIn(dir).length === 0) return ctx.skip();
    const args = ["--out", dir, "--no-health", "--env", brokenEnv];
    const red = tsx("ops-check.ts", args);
    expect(red.status, red.stdout).toBe(1);
    expect(red.stdout).toContain("ÉCHOUÉ");

    expect(node("backup-db.mjs", ["--out", dir]).status).toBe(0);
    const green = tsx("ops-check.ts", args);
    expect(green.status, green.stdout).toBe(0);
    expect(dumpsIn(dir)).toHaveLength(2);
  }, 240_000);

  it("le veilleur voit une archive effacée ou tronquée, et une sauvegarde qui n'a plus tourné depuis plus d'une nuit", (ctx) => {
    if (!ready || dumpsIn(dir).length === 0) return ctx.skip();
    const facts = readFacts(dir);
    expect(levels({ ...facts, now: facts.now + 27 * 3600_000 })["backup-recent"]).toBe("error");
    expect(levels({ ...facts, dumps: facts.dumps.map((d) => ({ ...d, sizeBytes: 300 })) })["backup-size"]).toBe("error");
    expect(levels({ ...facts, dumps: [] })["backup-file"]).toBe("error");
  });
});

// Lot 147 — les fichiers stockés sur le disque. `--with-uploads` n'archivait que les PHOTOS (public/uploads) : les pièces d'identité des
// vendeurs (private-uploads/identity, chiffrées) vivent aussi sur le disque, hors de la base, et une restauration après sinistre les
// PERDAIT. Chacune a maintenant SA archive (la seconde est la plus sensible). Vrais outils, vraie sauvegarde, vraie extraction.
describe("les fichiers du disque : photos ET pièces d'identité", () => {
  let work = "";
  let out = "";
  const PHOTO = Buffer.from("octets-de-photo-" + "p".repeat(500));
  const IDENTITY = Buffer.from("octets-chiffres-de-piece-d-identite-" + "éÿ".repeat(400), "latin1");

  // Un « serveur » factice : dossier de travail avec ses photos et ses pièces d'identité, sauvegardé avec la vraie base.
  const backup = (args: string[], withPrivate = true) => {
    rmSync(path.join(work, "private-uploads"), { recursive: true, force: true });
    if (withPrivate) {
      mkdirSync(path.join(work, "private-uploads", "identity"), { recursive: true });
      writeFileSync(path.join(work, "private-uploads", "identity", "piece.enc"), IDENTITY);
    }
    return spawnSync(process.execPath, [path.join(APP, "scripts", "backup-db.mjs"), "--out", out, "--env", ENV_FILE, ...args], { cwd: work, encoding: "utf8", timeout: 120_000 });
  };
  const status = () => JSON.parse(readFileSync(path.join(out, "status.json"), "utf8")) as OpsStatus;
  const archives = (prefix: string) => readdirSync(out).filter((n) => n.startsWith(prefix) && n.endsWith(".tar.gz"));

  beforeAll(() => {
    if (!ready) return;
    work = mkdtempSync(path.join(os.tmpdir(), "souq-disque-"));
    out = path.join(work, "sauvegardes");
    mkdirSync(path.join(work, "public", "uploads", "listings"), { recursive: true });
    writeFileSync(path.join(work, "public", "uploads", "listings", "photo.jpg"), PHOTO);
  });
  afterAll(() => {
    if (work) rmSync(work, { recursive: true, force: true });
  });

  it("archive les photos ET les pièces d'identité, chacune à part, et les journalise", (ctx) => {
    if (!ready) return ctx.skip();
    const run = backup(["--with-uploads"]);
    if (run.status === 2) return ctx.skip(); // outils PostgreSQL absents
    expect(run.status, run.stderr + run.stdout).toBe(0);

    expect(archives("uploads-")).toHaveLength(1);
    expect(archives("private-uploads-")).toHaveLength(1);
    expect(run.stdout).toContain("Photos archivées");
    expect(run.stdout).toContain("Pièces d'identité archivées");
    const success = status().backup!.lastSuccess!;
    expect(success.uploadsFile).toBe(archives("uploads-")[0]);
    expect(success.privateUploadsFile).toBe(archives("private-uploads-")[0]);
    expect(success.file).toMatch(/\.dump$/);
  }, 120_000);

  it("chaque archive se RESTITUE octet pour octet : la sauvegarde qu'on n'a jamais relue n'est pas une sauvegarde", (ctx) => {
    if (!ready || archives("private-uploads-").length === 0) return ctx.skip();
    const restored = mkdtempSync(path.join(os.tmpdir(), "souq-restaure-"));
    try {
      for (const name of [archives("uploads-")[0], archives("private-uploads-")[0]]) {
        const untar = spawnSync("tar", ["-xzf", toPosix(path.join(out, name)), "-C", toPosix(restored)], { encoding: "utf8" });
        expect(untar.status, untar.stderr).toBe(0);
      }
      expect(readFileSync(path.join(restored, "uploads", "listings", "photo.jpg")).equals(PHOTO)).toBe(true);
      expect(readFileSync(path.join(restored, "private-uploads", "identity", "piece.enc")).equals(IDENTITY)).toBe(true);
    } finally {
      rmSync(restored, { recursive: true, force: true });
    }
  }, 60_000);

  it("les pièces d'identité ne sont JAMAIS dans l'archive des photos, ni les photos dans la leur", (ctx) => {
    if (!ready || archives("private-uploads-").length === 0) return ctx.skip();
    const list = (name: string) => spawnSync("tar", ["-tzf", toPosix(path.join(out, name))], { encoding: "utf8" }).stdout;
    expect(list(archives("uploads-")[0])).not.toContain("identity");
    expect(list(archives("uploads-")[0])).not.toContain("private-uploads");
    expect(list(archives("private-uploads-")[0])).not.toContain("photo.jpg");
  });

  it("sans pièce d'identité envoyée (dossier absent), la sauvegarde réussit, le dit, et ne journalise pas d'archive fantôme", (ctx) => {
    if (!ready) return ctx.skip();
    const before = archives("private-uploads-").length;
    const run = backup(["--with-uploads"], false);
    if (run.status === 2) return ctx.skip();
    expect(run.status, run.stderr + run.stdout).toBe(0);
    expect(run.stdout).toContain("Aucun dossier private-uploads à archiver");
    expect(archives("private-uploads-")).toHaveLength(before); // aucune nouvelle archive
    const success = status().backup!.lastSuccess!;
    expect(success.uploadsFile).toBeDefined();
    expect(success.privateUploadsFile).toBeUndefined(); // et rien de faux dans le journal
  }, 120_000);

  it("sans --with-uploads, aucune archive de fichiers n'est écrite (comportement d'avant, inchangé)", (ctx) => {
    if (!ready) return ctx.skip();
    const uploadsBefore = archives("uploads-").length;
    const privateBefore = archives("private-uploads-").length;
    const run = backup([]);
    if (run.status === 2) return ctx.skip();
    expect(run.status, run.stderr + run.stdout).toBe(0);
    expect(archives("uploads-")).toHaveLength(uploadsBefore);
    expect(archives("private-uploads-")).toHaveLength(privateBefore);
    expect(status().backup!.lastSuccess!.privateUploadsFile).toBeUndefined();
  }, 120_000);

  it("la conservation (--keep) purge aussi les anciennes archives des pièces d'identité, jamais un fichier étranger", (ctx) => {
    if (!ready) return ctx.skip();
    const old = path.join(out, "private-uploads-20200101-000000.tar.gz");
    const foreign = path.join(out, "notes-de-l-equipe.tar.gz");
    writeFileSync(old, "ancienne archive");
    writeFileSync(foreign, "fichier étranger, à ne jamais supprimer");
    const longAgo = new Date("2020-01-01T00:00:00Z");
    utimesSync(old, longAgo, longAgo);
    utimesSync(foreign, longAgo, longAgo);
    const run = backup(["--with-uploads", "--keep", "7"]);
    if (run.status === 2) return ctx.skip();
    expect(run.status, run.stderr + run.stdout).toBe(0);
    expect(existsSync(old), "l'ancienne archive d'identité est purgée").toBe(false);
    expect(existsSync(foreign), "un fichier étranger n'est jamais touché").toBe(true);
    expect(archives("private-uploads-").length).toBeGreaterThan(0); // les récentes restent
  }, 120_000);
});
