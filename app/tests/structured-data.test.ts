import { describe, expect, it } from "vitest";
import { buildBreadcrumbJsonLd, buildVehicleJsonLd } from "@/lib/structured-data";

describe("buildBreadcrumbJsonLd", () => {
  it("numbers items starting at 1 in order", () => {
    const result = buildBreadcrumbJsonLd([
      { name: "Accueil", url: "https://example.com" },
      { name: "Renault", url: "https://example.com/voitures/renault" },
      { name: "Clio", url: "https://example.com/voitures/renault/clio" },
    ]);
    expect(result["@type"]).toBe("BreadcrumbList");
    expect(result.itemListElement).toHaveLength(3);
    expect(result.itemListElement[0]).toMatchObject({ position: 1, name: "Accueil" });
    expect(result.itemListElement[2]).toMatchObject({ position: 3, name: "Clio" });
  });

  it("returns an empty list for no items", () => {
    expect(buildBreadcrumbJsonLd([]).itemListElement).toEqual([]);
  });
});

describe("buildVehicleJsonLd", () => {
  const base = {
    title: "Renault Clio 4 diesel",
    description: "Très propre",
    url: "https://example.com/annonce/abc",
    images: ["https://example.com/uploads/listings/x.jpg"],
    price: 2_800_000,
    year: 2019,
    mileage: 85_000,
    fuelTypeLabel: "Diesel",
    gearboxLabel: "Manuelle",
  };

  it("always sets the vehicle type and offer price/currency", () => {
    const result = buildVehicleJsonLd(base);
    expect(result["@type"]).toBe("Vehicle");
    expect(result.offers).toMatchObject({
      "@type": "Offer",
      price: 2_800_000,
      priceCurrency: "DZD",
    });
  });

  it("includes brand/model only when provided", () => {
    const withoutCatalogue = buildVehicleJsonLd(base);
    expect(withoutCatalogue).not.toHaveProperty("brand");
    expect(withoutCatalogue).not.toHaveProperty("model");

    const withCatalogue = buildVehicleJsonLd({ ...base, brandName: "Renault", modelName: "Clio" });
    expect(withCatalogue.brand).toEqual({ "@type": "Brand", name: "Renault" });
    expect(withCatalogue.model).toBe("Clio");
  });

  it("expresses mileage as a schema.org QuantitativeValue in kilometers", () => {
    const result = buildVehicleJsonLd(base);
    expect(result.mileageFromOdometer).toEqual({
      "@type": "QuantitativeValue",
      value: 85_000,
      unitCode: "KMT",
    });
  });
});
