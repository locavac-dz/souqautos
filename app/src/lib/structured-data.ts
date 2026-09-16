// Sérialise un objet JSON-LD pour un <script dangerouslySetInnerHTML> — sans
// échappement, un titre/description d'annonce ou d'article contenant
// littéralement "</script><script>...</script>" fermerait prématurément la
// balise et injecterait du script exécutable (XSS stockée) chez tout
// visiteur de la page, `JSON.stringify` n'échappant jamais "<". Utilisé par
// TOUS les blocs JSON-LD de l'application, jamais un JSON.stringify direct
// dans un dangerouslySetInnerHTML.
export function safeJsonLdStringify(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function buildBreadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export type VehicleJsonLdInput = {
  title: string;
  description: string;
  url: string;
  images: string[];
  price: number;
  brandName?: string;
  modelName?: string;
  year: number;
  mileage: number;
  fuelTypeLabel: string;
  gearboxLabel: string;
};

export type ArticleJsonLdInput = {
  title: string;
  description: string;
  url: string;
  datePublished: string;
  dateModified: string;
  authorName: string;
};

// Lot 76 — schema.org Article pour le blog (docs/ARCHITECTURE.md §37 :
// « données structurées schema.org »), même principe que buildVehicleJsonLd.
export function buildArticleJsonLd(input: ArticleJsonLdInput) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: input.title,
    description: input.description,
    url: input.url,
    datePublished: input.datePublished,
    dateModified: input.dateModified,
    author: { "@type": "Organization", name: input.authorName },
  };
}

export function buildVehicleJsonLd(input: VehicleJsonLdInput) {
  return {
    "@context": "https://schema.org",
    "@type": "Vehicle",
    name: input.title,
    description: input.description,
    url: input.url,
    image: input.images,
    ...(input.brandName ? { brand: { "@type": "Brand", name: input.brandName } } : {}),
    ...(input.modelName ? { model: input.modelName } : {}),
    vehicleModelDate: String(input.year),
    mileageFromOdometer: {
      "@type": "QuantitativeValue",
      value: input.mileage,
      unitCode: "KMT",
    },
    fuelType: input.fuelTypeLabel,
    vehicleTransmission: input.gearboxLabel,
    offers: {
      "@type": "Offer",
      price: input.price,
      priceCurrency: "DZD",
      availability: "https://schema.org/InStock",
      url: input.url,
    },
  };
}
