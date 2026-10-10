// Lot 279 (audit C7) — la liste des espaces de noms envoyés au navigateur est recalculée depuis les sources :
// un `useTranslations("X")` ajouté sans mettre à jour CLIENT_NAMESPACES casserait X côté client en production.
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { CLIENT_NAMESPACES, pickClientMessages } from "@/i18n/client-namespaces";
import fr from "../messages/fr.json";

const SRC = path.resolve(__dirname, "../src");

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

describe("CLIENT_NAMESPACES", () => {
  it("contient exactement les espaces nommés par un useTranslations(\"…\") dans src/", () => {
    const found = new Set<string>();
    for (const file of sourceFiles(SRC)) {
      if (file.endsWith("i18n-audit.ts")) continue; // commente la syntaxe, ne l'utilise pas
      for (const m of readFileSync(file, "utf8").matchAll(/useTranslations\("([A-Za-z]+)"\)/g)) found.add(m[1]);
    }
    expect([...CLIENT_NAMESPACES].sort()).toEqual([...found].sort());
  });

  it("ne cite que des espaces qui existent dans le catalogue", () => {
    for (const ns of CLIENT_NAMESPACES) expect(fr).toHaveProperty(ns);
  });

  it("pickClientMessages ne garde que ces espaces", () => {
    const picked = pickClientMessages(fr as Record<string, unknown>);
    expect(Object.keys(picked).sort()).toEqual([...CLIENT_NAMESPACES].filter((ns) => ns in fr).sort());
    expect(Object.keys(picked).length).toBeLessThan(Object.keys(fr).length);
  });
});
