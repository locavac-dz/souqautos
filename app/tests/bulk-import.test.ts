import { describe, expect, it } from "vitest";
import { mapCsvRowToListingInput, listingToCsvRow, EXPORT_CSV_HEADER, type ImportLookups, type ListingForExport } from "@/lib/bulk-import";

function makeLookups(): ImportLookups {
  return {
    brands: new Map([
      ["renault", { id: 1, models: new Map([["clio", 10]]) }],
    ]),
    wilayas: new Map([["16", 16], ["alger", 16]]),
  };
}

function validRecord(overrides: Partial<Record<string, string>> = {}): Record<string, string> {
  return {
    categorie: "VOITURE",
    marque: "Renault",
    modele: "Clio",
    titre: "Renault Clio 4 diesel, très propre, entretien à jour",
    description: "Voiture bien entretenue, révisée régulièrement, aucun accident, vendue par un professionnel.",
    prix: "1500000",
    annee: "2019",
    kilometrage: "45000",
    carburant: "DIESEL",
    boiteVitesses: "MANUELLE",
    etat: "OCCASION",
    wilaya: "16",
    ...overrides,
  };
}

describe("mapCsvRowToListingInput", () => {
  it("maps a fully valid row, resolving brand/model/wilaya from the catalogue", () => {
    const result = mapCsvRowToListingInput(validRecord(), makeLookups());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.brandId).toBe(1);
      expect(result.data.modelId).toBe(10);
      expect(result.data.wilayaId).toBe(16);
      expect(result.data.price).toBe(1500000);
    }
  });

  it("resolves the wilaya by name as well as by code", () => {
    const result = mapCsvRowToListingInput(validRecord({ wilaya: "Alger" }), makeLookups());
    expect(result.ok).toBe(true);
  });

  it("falls back to free-text brand/model when not found in the catalogue", () => {
    const result = mapCsvRowToListingInput(
      validRecord({ marque: "MarqueInconnue", modele: "ModeleInconnu" }),
      makeLookups()
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.brandId).toBeUndefined();
      expect(result.data.brandFreeText).toBe("MarqueInconnue");
      expect(result.data.modelFreeText).toBe("ModeleInconnu");
    }
  });

  it("rejects a row with no brand at all", () => {
    const result = mapCsvRowToListingInput(validRecord({ marque: "" }), makeLookups());
    expect(result).toEqual({ ok: false, error: "missing_brand" });
  });

  it("rejects an unrecognized wilaya", () => {
    const result = mapCsvRowToListingInput(validRecord({ wilaya: "Narnia" }), makeLookups());
    expect(result).toEqual({ ok: false, error: "unknown_wilaya" });
  });

  it("rejects an invalid category", () => {
    const result = mapCsvRowToListingInput(validRecord({ categorie: "AVION" }), makeLookups());
    expect(result).toEqual({ ok: false, error: "invalid_category" });
  });

  it("rejects an invalid fuel type", () => {
    const result = mapCsvRowToListingInput(validRecord({ carburant: "NUCLEAIRE" }), makeLookups());
    expect(result).toEqual({ ok: false, error: "invalid_fuel_type" });
  });

  it("accepts enum values in any case", () => {
    const result = mapCsvRowToListingInput(
      validRecord({ categorie: "voiture", carburant: "diesel", boiteVitesses: "manuelle", etat: "occasion" }),
      makeLookups()
    );
    expect(result.ok).toBe(true);
  });

  it("rejects a non-numeric price", () => {
    const result = mapCsvRowToListingInput(validRecord({ prix: "pas un prix" }), makeLookups());
    expect(result).toEqual({ ok: false, error: "invalid_price" });
  });

  it("rejects a title that is too short (delegated to listingSchema)", () => {
    const result = mapCsvRowToListingInput(validRecord({ titre: "Court" }), makeLookups());
    expect(result).toEqual({ ok: false, error: "validation" });
  });

  it("parses oui/non into booleans for firstHand/accidented", () => {
    const result = mapCsvRowToListingInput(
      validRecord({ premiereMain: "oui", accidente: "non" }),
      makeLookups()
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.firstHand).toBe(true);
      expect(result.data.accidented).toBe(false);
    }
  });

  it("defaults optional booleans to false when absent", () => {
    const result = mapCsvRowToListingInput(validRecord(), makeLookups());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.firstHand).toBe(false);
      expect(result.data.accidented).toBe(false);
    }
  });

  it("rejects an invalid transmission value when one is provided", () => {
    const result = mapCsvRowToListingInput(validRecord({ transmission: "VOLANT" }), makeLookups());
    expect(result).toEqual({ ok: false, error: "invalid_transmission" });
  });

  it("leaves transmission optional when the column is blank", () => {
    const result = mapCsvRowToListingInput(validRecord({ transmission: "" }), makeLookups());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.transmission).toBeUndefined();
    }
  });
});

function makeListingForExport(overrides: Partial<ListingForExport> = {}): ListingForExport {
  return {
    category: "VOITURE",
    brand: { name: "Renault" },
    brandFreeText: null,
    model: { name: "Clio" },
    modelFreeText: null,
    title: "Renault Clio 4 diesel, très propre",
    description: "Voiture bien entretenue, révisée régulièrement.",
    price: 1500000,
    year: 2019,
    mileage: 45000,
    fuelType: "DIESEL",
    gearbox: "MANUELLE",
    transmission: null,
    color: null,
    doors: null,
    seats: null,
    powerHp: null,
    condition: "OCCASION",
    firstHand: false,
    accidented: false,
    wilaya: { nomFr: "Alger" },
    ...overrides,
  };
}

describe("listingToCsvRow", () => {
  it("produces a row matching EXPORT_CSV_HEADER's column count and order", () => {
    const row = listingToCsvRow(makeListingForExport());
    expect(row).toHaveLength(EXPORT_CSV_HEADER.length);
  });

  it("uses the catalogue brand/model name when the listing is linked to the catalogue", () => {
    const row = listingToCsvRow(makeListingForExport());
    expect(row[EXPORT_CSV_HEADER.indexOf("marque")]).toBe("Renault");
    expect(row[EXPORT_CSV_HEADER.indexOf("modele")]).toBe("Clio");
  });

  it("falls back to free text when the listing has no catalogue brand/model", () => {
    const row = listingToCsvRow(
      makeListingForExport({ brand: null, brandFreeText: "MarqueRare", model: null, modelFreeText: "ModeleRare" })
    );
    expect(row[EXPORT_CSV_HEADER.indexOf("marque")]).toBe("MarqueRare");
    expect(row[EXPORT_CSV_HEADER.indexOf("modele")]).toBe("ModeleRare");
  });

  it("round-trips through mapCsvRowToListingInput for a linked-catalogue listing", () => {
    const row = listingToCsvRow(makeListingForExport());
    const record = Object.fromEntries(EXPORT_CSV_HEADER.map((key, i) => [key, row[i]]));
    const lookups: ImportLookups = {
      brands: new Map([["renault", { id: 1, models: new Map([["clio", 10]]) }]]),
      wilayas: new Map([["alger", 16]]),
    };
    const result = mapCsvRowToListingInput(record, lookups);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.brandId).toBe(1);
      expect(result.data.modelId).toBe(10);
      expect(result.data.price).toBe(1500000);
    }
  });

  it("encodes booleans as oui/non, matching what the importer parses back to true/false", () => {
    const row = listingToCsvRow(makeListingForExport({ firstHand: true, accidented: false }));
    expect(row[EXPORT_CSV_HEADER.indexOf("premiereMain")]).toBe("oui");
    expect(row[EXPORT_CSV_HEADER.indexOf("accidente")]).toBe("non");
  });
});
