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

export function buildWebSiteJsonLd({ siteUrl, siteName, searchUrlTemplate }: { siteUrl: string; siteName: string; searchUrlTemplate: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    url: siteUrl,
    name: siteName,
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: searchUrlTemplate },
      "query-input": "required name=search_term_string",
    },
  };
}

export function buildOrganizationJsonLd({ siteUrl, siteName, logoUrl }: { siteUrl: string; siteName: string; logoUrl: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    url: siteUrl,
    name: siteName,
    logo: logoUrl,
  };
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
  // Lot 115 — adresse du document externe dont l'article est tiré, si elle existe.
  isBasedOn?: string;
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
    // Lot 115 — document externe dont l'article est tiré (dossier de presse…).
    ...(input.isBasedOn ? { isBasedOn: input.isBasedOn } : {}),
  };
}

export type AutoDealerJsonLdInput = {
  name: string;
  url: string;
  description?: string;
  image?: string;
  region?: string;
  ratingAverage: number;
  ratingCount: number;
};

// Lot 108 — schema.org AutoDealer pour la vitrine d'un compte pro. Volontairement
// sans téléphone ni horaires : le numéro n'a rien à faire dans une page publique
// crawlable (cf. Lot 107), et `horaires` est un texte libre, pas un format
// schema.org. `aggregateRating` seulement s'il existe au moins un avis.
export function buildAutoDealerJsonLd(input: AutoDealerJsonLdInput) {
  return {
    "@context": "https://schema.org",
    "@type": "AutoDealer",
    name: input.name,
    url: input.url,
    ...(input.description ? { description: input.description } : {}),
    ...(input.image ? { image: input.image } : {}),
    address: {
      "@type": "PostalAddress",
      ...(input.region ? { addressRegion: input.region } : {}),
      addressCountry: "DZ",
    },
    ...(input.ratingCount > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: input.ratingAverage,
            reviewCount: input.ratingCount,
          },
        }
      : {}),
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

export type ReviewJsonLdInput = {
  url: string;
  title: string;
  verdict: string;
  // Nom du véhicule testé (« Marque Modèle »), à défaut le titre de l'essai.
  itemName: string;
  brandName?: string;
  ratingValue: number;
  authorName: string;
  // Person quand l'essai est signé d'un nom, Organization quand il est signé « Souq Auto ».
  authorIsPerson: boolean;
  datePublished: string;
  dateModified: string;
  image?: string;
};

// Lot 110 — schema.org Review pour un essai auto : `itemReviewed` de type Car,
// note sur 5 (`bestRating` 5, `worstRating` 1). Seule la note réellement
// attribuée par la rédaction est publiée, jamais une note agrégée inventée.
export function buildReviewJsonLd(input: ReviewJsonLdInput) {
  return {
    "@context": "https://schema.org",
    "@type": "Review",
    name: input.title,
    url: input.url,
    reviewBody: input.verdict,
    itemReviewed: {
      "@type": "Car",
      name: input.itemName,
      ...(input.brandName ? { brand: { "@type": "Brand", name: input.brandName } } : {}),
    },
    reviewRating: {
      "@type": "Rating",
      ratingValue: input.ratingValue,
      bestRating: 5,
      worstRating: 1,
    },
    author: { "@type": input.authorIsPerson ? "Person" : "Organization", name: input.authorName },
    publisher: { "@type": "Organization", name: "Souq Auto" },
    datePublished: input.datePublished,
    dateModified: input.dateModified,
    ...(input.image ? { image: input.image } : {}),
  };
}
