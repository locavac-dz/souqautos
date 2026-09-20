import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSearchBrands, getSearchWilayas } = vi.hoisted(() => ({ getSearchBrands: vi.fn(), getSearchWilayas: vi.fn() }));
vi.mock("@/lib/reference-data", () => ({ getSearchBrands: () => getSearchBrands(), getSearchWilayas: () => getSearchWilayas() }));

import { buildListingWhere } from "@/lib/search";
import { matchCatalogue, resolveListingWhere } from "@/lib/search-query";
import { searchParamsSchema } from "@/lib/validation/search";

const brands = [
  { id: 1, name: "Renault", models: [{ id: 10, name: "Clio" }, { id: 11, name: "Kangoo" }, { id: 12, name: "Mégane" }] },
  { id: 2, name: "Peugeot", models: [{ id: 20, name: "208" }, { id: 21, name: "Partner" }] },
  { id: 3, name: "Volkswagen", models: [{ id: 30, name: "Golf" }, { id: 31, name: "Polo" }] },
];
const wilayas = [
  { id: 16, nomFr: "Alger", nomAr: "الجزائر" },
  { id: 31, nomFr: "Oran", nomAr: "وهران" },
  { id: 9, nomFr: "Blida", nomAr: "البليدة" },
];

describe("matchCatalogue — le mot cherché dans les noms de marques, de modèles et de wilayas", () => {
  it("trouve sans tenir compte de la casse, et n'importe où dans le nom (« contient »)", () => {
    expect(matchCatalogue("clio", brands, wilayas)).toEqual({ brandIds: [], modelIds: [10], wilayaIds: [] });
    expect(matchCatalogue("CLIO", brands, wilayas).modelIds).toEqual([10]);
    expect(matchCatalogue("lio", brands, wilayas).modelIds).toEqual([10]);
    expect(matchCatalogue("ren", brands, wilayas).brandIds).toEqual([1]);
    expect(matchCatalogue("o", brands, wilayas)).toEqual({ brandIds: [2, 3], modelIds: [10, 11, 30, 31], wilayaIds: [31] }); // Peugeot, Volkswagen ; Clio, Kangoo, Golf, Polo ; Oran
  });

  it("cherche dans les deux noms de wilaya, français et arabe", () => {
    expect(matchCatalogue("alger", brands, wilayas).wilayaIds).toEqual([16]);
    expect(matchCatalogue("ALGER", brands, wilayas).wilayaIds).toEqual([16]);
    expect(matchCatalogue("الجزائر", brands, wilayas).wilayaIds).toEqual([16]);
    expect(matchCatalogue("وهران", brands, wilayas).wilayaIds).toEqual([31]);
    expect(matchCatalogue("ال", brands, wilayas).wilayaIds).toEqual([16, 9]);
  });

  it("ne plie PAS les accents, comme la recherche d'origine : « megane » ne trouve pas « Mégane »", () => {
    expect(matchCatalogue("megane", brands, wilayas).modelIds).toEqual([]);
    expect(matchCatalogue("mégane", brands, wilayas).modelIds).toEqual([12]);
  });

  it("garde les jokers de la recherche d'origine (Prisma ne les protège pas) : « % » et « _ » trouvent tout, « c_io » trouve « Clio »", () => {
    expect(matchCatalogue("%", brands, wilayas)).toEqual({ brandIds: [1, 2, 3], modelIds: [10, 11, 12, 20, 21, 30, 31], wilayaIds: [16, 31, 9] });
    expect(matchCatalogue("_", brands, wilayas).brandIds).toEqual([1, 2, 3]);
    expect(matchCatalogue("c_io", brands, wilayas).modelIds).toEqual([10]);
    expect(matchCatalogue("k%o", brands, wilayas).modelIds).toEqual([11]); // Kangoo
    expect(matchCatalogue("\\_", brands, wilayas)).toEqual({ brandIds: [], modelIds: [], wilayaIds: [] }); // « \_ » : un « _ » LITTÉRAL (protégé), absent des noms
  });

  it("un mot qui ne correspond à rien donne trois listes vides", () => {
    expect(matchCatalogue("zzzz", brands, wilayas)).toEqual({ brandIds: [], modelIds: [], wilayaIds: [] });
  });
});

describe("buildListingWhere — la forme rapide", () => {
  const params = searchParamsSchema.parse({ q: "clio" });

  it("garde la forme d'origine (par relations) sans résultats de catalogue : c'est la référence", () => {
    const or = buildListingWhere(params).OR!;
    expect(or).toHaveLength(7);
    expect(JSON.stringify(or)).toContain('"brand":{"name"');
    expect(JSON.stringify(or)).toContain('"wilaya":{"nomFr"');
  });

  it("avec les résultats du catalogue : titre + textes libres + identifiants, AUCUNE relation (donc aucune jointure)", () => {
    const or = buildListingWhere(params, { brandIds: [1], modelIds: [10, 11], wilayaIds: [16] }).OR!;
    expect(or).toHaveLength(6);
    expect(or).toContainEqual({ brandId: { in: [1] } });
    expect(or).toContainEqual({ modelId: { in: [10, 11] } });
    expect(or).toContainEqual({ wilayaId: { in: [16] } });
    expect(JSON.stringify(or)).not.toMatch(/"(brand|model|wilaya)":\{/);
  });

  it("n'écrit pas de clause pour une liste vide (le titre et les textes libres restent)", () => {
    const or = buildListingWhere(params, { brandIds: [], modelIds: [], wilayaIds: [] }).OR!;
    expect(or).toHaveLength(3);
    expect(or.map((clause) => Object.keys(clause)[0])).toEqual(["title", "brandFreeText", "modelFreeText"]);
  });

  it("les autres filtres sont inchangés, avec ou sans mot", () => {
    const filtered = searchParamsSchema.parse({ q: "clio", category: "VOITURE", wilayaId: "16", priceMax: "2000000" });
    const a = buildListingWhere(filtered);
    const b = buildListingWhere(filtered, { brandIds: [], modelIds: [10], wilayaIds: [] });
    const { OR: _a, ...restA } = a;
    const { OR: _b, ...restB } = b;
    void _a;
    void _b;
    expect(restB).toEqual(restA);
    expect(restA).toMatchObject({ status: "PUBLIEE", category: "VOITURE", wilayaId: 16, price: { lte: 2000000 } });
  });

  it("sans mot cherché : aucune clause OR", () => {
    expect(buildListingWhere(searchParamsSchema.parse({ category: "VOITURE" })).OR).toBeUndefined();
  });
});

describe("resolveListingWhere", () => {
  beforeEach(() => {
    getSearchBrands.mockReset().mockResolvedValue(brands);
    getSearchWilayas.mockReset().mockResolvedValue(wilayas);
  });

  it("cherche le mot dans le catalogue (en cache) puis rend la forme sans jointure", async () => {
    const where = await resolveListingWhere(searchParamsSchema.parse({ q: "clio" }));
    expect(where.OR).toContainEqual({ modelId: { in: [10] } });
    expect(JSON.stringify(where.OR)).not.toMatch(/"(brand|model|wilaya)":\{/);
    expect(getSearchBrands).toHaveBeenCalledTimes(1);
  });

  it("sans mot, ne touche même pas au catalogue", async () => {
    const where = await resolveListingWhere(searchParamsSchema.parse({ category: "VOITURE" }));
    expect(where).toEqual({ status: "PUBLIEE", category: "VOITURE" });
    expect(getSearchBrands).not.toHaveBeenCalled();
    expect(getSearchWilayas).not.toHaveBeenCalled();
  });

  it("propage un échec du catalogue au lieu de rendre une recherche silencieusement incomplète", async () => {
    getSearchBrands.mockRejectedValue(new Error("base indisponible"));
    await expect(resolveListingWhere(searchParamsSchema.parse({ q: "clio" }))).rejects.toThrow("base indisponible");
  });
});
