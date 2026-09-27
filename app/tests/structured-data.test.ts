import { describe, expect, it } from "vitest";
import {
  buildAutoDealerJsonLd,
  buildBreadcrumbJsonLd,
  buildItemListJsonLd,
  buildPlaceJsonLd,
  buildReviewJsonLd,
  buildVehicleJsonLd,
  safeJsonLdStringify,
} from "@/lib/structured-data";

// Lot 221 — fonctions JSON-LD ajoutées aux Lots 216 et 214.
describe("buildItemListJsonLd", () => {
  it("sets the ItemList type and numbers items from 1", () => {
    const result = buildItemListJsonLd([
      { name: "Renault Clio", url: "https://example.com/voitures/renault/clio" },
      { name: "Renault Megane", url: "https://example.com/voitures/renault/megane" },
    ]);
    expect(result["@type"]).toBe("ItemList");
    expect(result.itemListElement).toHaveLength(2);
    expect(result.itemListElement[0]).toMatchObject({ "@type": "ListItem", position: 1, name: "Renault Clio" });
    expect(result.itemListElement[1]).toMatchObject({ position: 2, name: "Renault Megane" });
  });

  it("returns an empty itemListElement for an empty input", () => {
    expect(buildItemListJsonLd([]).itemListElement).toEqual([]);
  });

  it("includes the url on each list item", () => {
    const url = "https://example.com/voitures/renault/clio";
    const result = buildItemListJsonLd([{ name: "Renault Clio", url }]);
    expect(result.itemListElement[0].url).toBe(url);
  });
});

describe("buildPlaceJsonLd", () => {
  const base = {
    name: "Alger",
    url: "https://example.com/fr/wilaya/alger",
    containedInPlaceUrl: "https://example.com/fr",
  };

  it("sets the Place type with the correct name and url", () => {
    const result = buildPlaceJsonLd(base);
    expect(result["@type"]).toBe("Place");
    expect(result.name).toBe("Alger");
    expect(result.url).toBe(base.url);
  });

  it("embeds Algeria as the parent country", () => {
    const result = buildPlaceJsonLd(base);
    expect(result.containedInPlace).toMatchObject({
      "@type": "Country",
      name: "Algérie",
      url: base.containedInPlaceUrl,
    });
  });
});

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

// Lot 98 (audit sécurité) : une annonce/un article avec un titre/description
// contenant littéralement "</script>" ne doit jamais pouvoir fermer la
// balise <script type="application/ld+json"> qui l'embarque — ce qui
// injecterait du script exécutable chez tout visiteur (XSS stockée).
describe("safeJsonLdStringify", () => {
  it("échappe les '<' pour empêcher une évasion de balise </script>", () => {
    const malicious = buildVehicleJsonLd({
      title: '</script><script>alert(document.cookie)</script>',
      description: "Description normale",
      url: "https://example.com/annonce/abc",
      images: [],
      price: 1,
      year: 2019,
      mileage: 1,
      fuelTypeLabel: "Diesel",
      gearboxLabel: "Manuelle",
    });

    const serialized = safeJsonLdStringify(malicious);
    expect(serialized).not.toContain("</script>");
    expect(serialized).not.toContain("<script>");
    expect(serialized).toContain("\\u003c/script>");
    // Le contenu reste intact une fois désérialisé côté navigateur — seul
    // l'échappement "<" change, jamais une perte ou altération de données.
    expect(JSON.parse(serialized).name).toBe(malicious.name);
  });

  it("produit un JSON strictement identique à JSON.stringify pour un contenu sans '<'", () => {
    const data = { a: 1, b: "texte normal" };
    expect(safeJsonLdStringify(data)).toBe(JSON.stringify(data));
  });
});

describe("buildAutoDealerJsonLd", () => {
  const base = { name: "Auto Sara Motors", url: "https://example.com/fr/pro/abc", ratingAverage: 0, ratingCount: 0 };

  it("sets the AutoDealer type and an Algerian address", () => {
    const result = buildAutoDealerJsonLd(base);
    expect(result["@type"]).toBe("AutoDealer");
    expect(result.address).toMatchObject({ "@type": "PostalAddress", addressCountry: "DZ" });
  });

  it("omits the rating when the account has no review", () => {
    expect(buildAutoDealerJsonLd(base)).not.toHaveProperty("aggregateRating");
  });

  it("adds the aggregate rating once there is at least one review", () => {
    const result = buildAutoDealerJsonLd({ ...base, ratingAverage: 4.5, ratingCount: 2 });
    expect(result.aggregateRating).toMatchObject({ ratingValue: 4.5, reviewCount: 2 });
  });

  it("only includes the optional fields that are provided", () => {
    const bare = buildAutoDealerJsonLd(base);
    expect(bare).not.toHaveProperty("description");
    expect(bare).not.toHaveProperty("image");
    expect(bare.address).not.toHaveProperty("addressRegion");

    const full = buildAutoDealerJsonLd({ ...base, description: "d", image: "https://example.com/l.jpg", region: "Alger" });
    expect(full.description).toBe("d");
    expect(full.image).toBe("https://example.com/l.jpg");
    expect(full.address).toMatchObject({ addressRegion: "Alger" });
  });

  it("never exposes a phone number", () => {
    expect(JSON.stringify(buildAutoDealerJsonLd({ ...base, ratingAverage: 5, ratingCount: 1 }))).not.toMatch(/telephone|phone/i);
  });
});

describe("buildReviewJsonLd", () => {
  const base = {
    url: "https://example.com/fr/essais/citroen-c4",
    title: "Essai Citroën C4",
    verdict: "Une compacte confortable et bien équipée.",
    itemName: "Citroën C4",
    ratingValue: 3.5,
    authorName: "Souq Auto",
    authorIsPerson: false,
    datePublished: "2026-09-01T08:00:00.000Z",
    dateModified: "2026-09-05T08:00:00.000Z",
  };

  it("describes a review of a Car with a rating out of 5", () => {
    const result = buildReviewJsonLd(base);
    expect(result["@type"]).toBe("Review");
    expect(result.itemReviewed).toMatchObject({ "@type": "Car", name: "Citroën C4" });
    expect(result.reviewRating).toEqual({ "@type": "Rating", ratingValue: 3.5, bestRating: 5, worstRating: 1 });
  });

  it("signs with a Person when the essai has a named author, an Organization otherwise", () => {
    expect(buildReviewJsonLd(base).author).toEqual({ "@type": "Organization", name: "Souq Auto" });
    expect(buildReviewJsonLd({ ...base, authorName: "Sara Hamdi", authorIsPerson: true }).author).toEqual({
      "@type": "Person",
      name: "Sara Hamdi",
    });
  });

  it("only includes the brand and image when provided", () => {
    const bare = buildReviewJsonLd(base);
    expect(bare.itemReviewed).not.toHaveProperty("brand");
    expect(bare).not.toHaveProperty("image");
    const full = buildReviewJsonLd({ ...base, brandName: "Citroën", image: "https://example.com/c4.jpg" });
    expect(full.itemReviewed).toMatchObject({ brand: { "@type": "Brand", name: "Citroën" } });
    expect(full.image).toBe("https://example.com/c4.jpg");
  });
});
