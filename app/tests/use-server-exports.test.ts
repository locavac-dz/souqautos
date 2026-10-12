import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Next.js n'accepte, dans un fichier « use server », que des fonctions asynchrones exportées (les types sont effacés à
// la compilation). Une constante exportée fait échouer le chargement du module : c'est ce qui a cassé l'étape 5 de
// l'assistant de publication (PRICE_ESTIMATE_RATE_LIMIT, lot 267), sans qu'aucun test unitaire ne s'en aperçoive.

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

const USE_SERVER = /^\s*["']use server["']/m;
// Tout export qui n'est ni un type, ni une interface, ni une fonction asynchrone.
const FORBIDDEN_EXPORT = /^export\s+(?!async\s+function\b|type\b|interface\b)(?:default\b|const\b|let\b|var\b|class\b|enum\b|function\b|\{|\*)/m;

describe("fichiers « use server »", () => {
  const files = sourceFiles("src").filter((file) => USE_SERVER.test(readFileSync(file, "utf8")));

  it("en trouve au moins un (sinon ce garde-fou ne vérifie plus rien)", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)("%s n'exporte que des fonctions asynchrones et des types", (file) => {
    const match = FORBIDDEN_EXPORT.exec(readFileSync(file, "utf8"));
    expect(match?.[0] ?? null).toBeNull();
  });

  it("reconnaît le défaut qu'il doit attraper", () => {
    expect(FORBIDDEN_EXPORT.test("export const LIMIT = { limit: 30 };")).toBe(true);
    expect(FORBIDDEN_EXPORT.test("export function sync() {}")).toBe(true);
    expect(FORBIDDEN_EXPORT.test("export async function ok() {}")).toBe(false);
    expect(FORBIDDEN_EXPORT.test("export type Input = { a: number };")).toBe(false);
  });
});
