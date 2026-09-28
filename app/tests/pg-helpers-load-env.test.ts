import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadEnv } from "../scripts/pg-helpers.mjs";

// Lot 233 — dans le conteneur tools (docker-compose.example.yml), la configuration vient des variables d'environnement et il n'y a
// pas de .env : les scripts de sauvegarde ne doivent plus s'arrêter pour ça. Un --env explicite vers un fichier absent reste une erreur.
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), "souq-load-env-"));
  vi.spyOn(process, "cwd").mockReturnValue(dir);
  vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
    throw new Error(`exit ${code}`);
  }) as never);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(dir, { recursive: true, force: true });
  delete process.env.SOUQ_LOAD_ENV_TEST;
});

describe("loadEnv — scripts de sauvegarde (pg-helpers.mjs)", () => {
  it("sans --env et sans .env : continue avec les variables d'environnement (rend null)", () => {
    expect(loadEnv(["node", "backup-db.mjs"])).toBeNull();
    expect(process.exit).not.toHaveBeenCalled();
  });

  it("sans --env, avec un .env : le lit", () => {
    writeFileSync(path.join(dir, ".env"), "SOUQ_LOAD_ENV_TEST=lu\n");
    expect(loadEnv(["node", "backup-db.mjs"])).toBe(path.join(dir, ".env"));
    expect(process.env.SOUQ_LOAD_ENV_TEST).toBe("lu");
  });

  it("--env vers un fichier absent : erreur de configuration (code 2), pas de repli silencieux", () => {
    expect(() => loadEnv(["node", "backup-db.mjs", "--env", "prod.env"])).toThrow("exit 2");
  });
});
