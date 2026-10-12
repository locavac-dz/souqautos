import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

// Next.js : « quand la réponse est diffusée en flux (loading.tsx), le statut 200 est déjà parti : un notFound() levé
// ensuite ne peut plus le changer ». Un `loading.tsx` enveloppe aussi les routes IMBRIQUÉES. Une page publique qui peut
// répondre 404 ne doit donc se trouver sous aucun `loading.tsx` (lots 131 et 269) — sauf si un layout vérifie son
// existence au-dessus de la frontière (c'est le cas de la fiche annonce, qui garde ainsi son squelette).
const APP = join("src", "app", "[locale]");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

// Espaces privés : jamais indexés, le statut HTTP d'une page introuvable n'y a pas d'enjeu public.
const PRIVATE = ["admin", "compte", join("pro", "(prive)")];
const isPrivate = (route: string) => PRIVATE.some((prefix) => route === prefix || route.startsWith(prefix + sep));

// Pages publiques dont un layout vérifie l'existence avant le flux.
const CHECKED_BY_LAYOUT = [join("annonce", "[id]")];

const files = walk(APP);
const loadingDirs = files.filter((f) => f.endsWith(`${sep}loading.tsx`)).map((f) => relative(APP, join(f, "..")));
const notFoundPages = files
  .filter((f) => f.endsWith(`${sep}page.tsx`) && /\bnotFound\(\)/.test(readFileSync(f, "utf8")))
  .map((f) => relative(APP, join(f, "..")));

describe("loading.tsx et pages pouvant répondre 404", () => {
  it("connaît des pages qui lèvent notFound() et des loading.tsx (sinon ce garde-fou ne vérifie plus rien)", () => {
    expect(notFoundPages.length).toBeGreaterThan(0);
    expect(loadingDirs.length).toBeGreaterThan(0);
  });

  it("aucune page publique pouvant répondre 404 n'est sous un loading.tsx", () => {
    const offenders = notFoundPages.filter((page) => {
      if (isPrivate(page) || CHECKED_BY_LAYOUT.includes(page)) return false;
      return loadingDirs.some((dir) => dir === "" || page === dir || page.startsWith(dir + sep));
    });
    expect(offenders).toEqual([]);
  });

  it("les pages vérifiées par layout ont bien ce layout, sans autre loading.tsx au-dessus de lui", () => {
    for (const page of CHECKED_BY_LAYOUT) {
      const layout = join(APP, page, "layout.tsx");
      expect(existsSync(layout), layout).toBe(true);
      expect(readFileSync(layout, "utf8")).toMatch(/\bnotFound\(\)/);
      const above = loadingDirs.filter((dir) => dir !== page && page.startsWith(dir + sep));
      expect(above, `loading.tsx au-dessus de ${page}`).toEqual([]);
    }
  });
});
