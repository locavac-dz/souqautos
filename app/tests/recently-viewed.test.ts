import { describe, expect, it } from "vitest";
import { mergeEntry, MAX_RECENTLY_VIEWED, type RecentlyViewedEntry } from "@/lib/recently-viewed";

function makeEntry(id: string, overrides: Partial<RecentlyViewedEntry> = {}): RecentlyViewedEntry {
  return {
    id,
    title: `Annonce ${id}`,
    price: 1_000_000,
    photo: null,
    brandLabel: "Renault",
    modelLabel: "Clio",
    year: 2020,
    wilayaNomFr: "Alger",
    wilayaNomAr: "الجزائر",
    viewedAt: Date.now(),
    ...overrides,
  };
}

describe("mergeEntry — logique de gestion des annonces récemment vues", () => {
  it("insère en tête d'une liste vide", () => {
    const result = mergeEntry([], makeEntry("a"));
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("a");
  });

  it("insère en tête d'une liste existante", () => {
    const result = mergeEntry([makeEntry("b"), makeEntry("c")], makeEntry("a"));
    expect(result[0].id).toBe("a");
    expect(result[1].id).toBe("b");
    expect(result[2].id).toBe("c");
  });

  it("déduplique : remonter un élément déjà présent le déplace en tête", () => {
    const result = mergeEntry([makeEntry("a"), makeEntry("b"), makeEntry("c")], makeEntry("b"));
    expect(result.map((e) => e.id)).toEqual(["b", "a", "c"]);
  });

  it("ne duplique pas si le même id est ajouté plusieurs fois", () => {
    let list = mergeEntry([], makeEntry("x"));
    list = mergeEntry(list, makeEntry("x"));
    list = mergeEntry(list, makeEntry("x"));
    expect(list).toHaveLength(1);
  });

  it(`plafonne à ${MAX_RECENTLY_VIEWED} entrées`, () => {
    const existing = Array.from({ length: MAX_RECENTLY_VIEWED }, (_, i) => makeEntry(String(i)));
    const result = mergeEntry(existing, makeEntry("new"));
    expect(result).toHaveLength(MAX_RECENTLY_VIEWED);
    expect(result[0].id).toBe("new");
  });

  it("supprime l'entrée la plus ancienne (la dernière) quand la liste est pleine", () => {
    const existing = Array.from({ length: MAX_RECENTLY_VIEWED }, (_, i) => makeEntry(String(i)));
    const result = mergeEntry(existing, makeEntry("new"));
    expect(result.map((e) => e.id)).not.toContain(String(MAX_RECENTLY_VIEWED - 1));
  });

  it("la liste originale n'est pas mutée", () => {
    const original = [makeEntry("a"), makeEntry("b")];
    mergeEntry(original, makeEntry("c"));
    expect(original).toHaveLength(2);
  });

  it("mise à jour des métadonnées : re-visionner une annonce met à jour son viewedAt", () => {
    const old = makeEntry("a", { viewedAt: 1000 });
    const fresh = makeEntry("a", { viewedAt: 9999 });
    const result = mergeEntry([old], fresh);
    expect(result[0].viewedAt).toBe(9999);
  });
});
