import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { safeCreditUrl } from "@/lib/photo-credit";

// Lot 125 — garde-fous sur les photos de démonstration rangées dans prisma/demo-photos/ : ce sont des
// œuvres de tiers, redistribuées sous licence libre, dont les conditions (auteur, licence, source)
// doivent rester complètes et cohérentes avec les fichiers réellement présents.
const DIR = path.resolve(__dirname, "../prisma/demo-photos");
type Credit = { file: string; title: string; author: string; license: string; licenseUrl: string; sourceUrl: string; width: number; height: number };
const credits: Record<string, Credit> = JSON.parse(readFileSync(path.join(DIR, "CREDITS.json"), "utf8"));
const entries = Object.entries(credits);

// Licences acceptées : celles qui autorisent la redistribution avec les seules obligations qu'on remplit
// (nommer l'auteur, indiquer la licence, renvoyer à la source), ou qui n'en imposent aucune.
const ALLOWED_LICENSE = /^(CC BY(-SA)? [0-9.]+( [a-z]+)?|CC0.*|Public domain)$/;

describe("prisma/demo-photos — crédits", () => {
  it("has exactly one photo file per credit entry, and no file without a credit", () => {
    const files = readdirSync(DIR).filter((f) => f.endsWith(".jpg")).sort();
    expect(entries.map(([, c]) => c.file).sort()).toEqual(files);
    expect(new Set(entries.map(([, c]) => c.file)).size).toBe(entries.length);
  });

  it.each(entries)("%s: author, licence and links are complete and allowed", (_key, c) => {
    expect(c.author.trim().length).toBeGreaterThan(1);
    expect(c.author).not.toMatch(/<|>|&lt;|&gt;|https?:/); // du texte, jamais du HTML ni un lien collé par erreur
    expect(c.license).toMatch(ALLOWED_LICENSE);
    expect(safeCreditUrl(c.licenseUrl), c.licenseUrl).toBe(c.licenseUrl);
    expect(c.licenseUrl).toContain("creativecommons.org");
    expect(safeCreditUrl(c.sourceUrl), c.sourceUrl).toBe(c.sourceUrl);
    expect(c.sourceUrl).toContain("commons.wikimedia.org/wiki/File:");
    expect(c.title.length).toBeGreaterThan(5);
  });

  it("does not use a licence that forbids commercial use or derivatives", () => {
    for (const [, c] of entries) expect(c.license).not.toMatch(/-NC|-ND/);
  });
});

describe("prisma/demo-photos — fichiers", () => {
  it.each(entries)("%s: is a real JPEG, landscape, large enough, of reasonable weight", async (_key, c) => {
    const file = path.join(DIR, c.file);
    const bytes = readFileSync(file);
    expect([bytes[0], bytes[1]]).toEqual([0xff, 0xd8]); // vrais octets JPEG, pas seulement l'extension
    const meta = await sharp(bytes).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.width).toBeGreaterThanOrEqual(1600);
    expect(meta.width! / meta.height!).toBeGreaterThan(1.2);
    expect({ width: meta.width, height: meta.height }).toEqual({ width: c.width, height: c.height }); // crédits = fichier
    expect(statSync(file).size).toBeLessThan(1024 * 1024);
  });

  it("stays a light folder (it is committed to the repository)", () => {
    const total = readdirSync(DIR).filter((f) => f.endsWith(".jpg")).reduce((s, f) => s + statSync(path.join(DIR, f)).size, 0);
    expect(total).toBeLessThan(16 * 1024 * 1024);
  });
});

describe("prisma/demo-photos — couverture du script de démonstration", () => {
  it("has a photo for every brand/model that seed-demo-listings.ts creates", () => {
    const seed = readFileSync(path.resolve(__dirname, "../prisma/seed-demo-listings.ts"), "utf8");
    const used = new Set([...seed.matchAll(/brand: "([^"]+)", model: "([^"]+)"/g)].map((m) => `${m[1]} ${m[2]}`));
    expect(used.size).toBeGreaterThanOrEqual(24);
    const missing = [...used].filter((k) => !credits[k]);
    expect(missing).toEqual([]);
  });

  it("documents every photo in the folder's README, for whoever redistributes the repository", () => {
    const readme = readFileSync(path.join(DIR, "README.md"), "utf8");
    for (const [key, c] of entries) {
      expect(readme, key).toContain(c.sourceUrl);
      expect(readme, key).toContain(c.author);
    }
  });
});
