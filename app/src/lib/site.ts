export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:5184").replace(
  /\/$/,
  ""
);

// Construit une URL absolue à partir d'un chemin de photo stocké — celui-ci
// est soit déjà une URL absolue (stockage S3, cf. src/lib/uploads.ts), soit
// un chemin relatif local ("/uploads/..."), jamais mélangé au préfixe
// SITE_URL par erreur (ce qui produirait "https://site.comhttps://bucket...").
export function resolveAbsolutePhotoUrl(storedPath: string): string {
  return storedPath.startsWith("http") ? storedPath : `${SITE_URL}${storedPath}`;
}

// Libellés marque/modèle/wilaya partagés par ListingCard (recherche) et
// AdvisorListingCard (conseiller IA) — même repli catalogue/texte libre pour
// la marque et le modèle, même choix de langue pour la wilaya (Lot 97).
export function resolveListingLabels(
  listing: {
    brand: { name: string } | null;
    model: { name: string } | null;
    brandFreeText: string | null;
    modelFreeText: string | null;
    wilaya: { nomFr: string; nomAr: string };
  },
  locale: string
): { brandLabel: string; modelLabel: string; wilayaLabel: string } {
  return {
    brandLabel: listing.brand?.name ?? listing.brandFreeText ?? "",
    modelLabel: listing.model?.name ?? listing.modelFreeText ?? "",
    wilayaLabel: locale === "ar" ? listing.wilaya.nomAr : listing.wilaya.nomFr,
  };
}
