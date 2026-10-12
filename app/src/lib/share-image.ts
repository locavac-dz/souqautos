// Lot 142 — la carte de partage d'une annonce (l'image qui s'affiche quand on colle le lien dans WhatsApp, Facebook, Messenger…).
//
// Ce module ne fait que DÉCIDER DU TEXTE de la carte : pur, sans base ni image, donc testé à fond (tests/share-image.test.ts).
// Le dessin est dans src/lib/share-image-render.tsx.
//
// Deux contraintes techniques dictent la forme du texte :
//  - La police embarquée dans `ImageResponse` (Geist) ne contient QUE le latin : un titre en arabe s'y afficherait en carrés vides.
//    Tout caractère hors latin est donc retiré (`latinSafe`) — la carte se compose de la marque, du modèle (noms latins du
//    catalogue), de l'année, du kilométrage, de la wilaya (nom français) et du prix : elle est la même pour toutes les langues.
//  - `ImageResponse` va chercher les emojis sur un service externe (Twemoji). Les retirer évite un appel réseau sortant, à
//    chaque génération, déclenché par du texte saisi par un vendeur.

const FUEL_LABEL: Record<string, string> = {
  ESSENCE: "Essence",
  DIESEL: "Diesel",
  GPL: "GPL",
  HYBRIDE: "Hybride",
  ELECTRIQUE: "Électrique",
};

// Latin de base, Latin-1 (accents français), Œ/œ, et quelques signes de ponctuation. Rien d'autre.
const NOT_LATIN_SAFE = /[^\u0020-\u007E\u00A0-\u00FF\u0152\u0153\u2013\u2014\u2019]/g;

export function latinSafe(text: string): string {
  return text.replace(NOT_LATIN_SAFE, "").replace(/\s+/g, " ").trim();
}

// Coupe proprement : jamais au milieu d'un mot si on peut l'éviter, et « ... » (trois points ASCII) pour ne dépendre d'aucun glyphe.
export function truncateLabel(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 3);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}...`;
}

// Espaces ordinaires : l'espace fine insécable d'`Intl` (U+202F) n'existe pas dans la police embarquée.
export function formatSharePrice(price: number): string {
  const rounded = Math.round(price);
  return `${String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} DA`;
}

export function formatShareMileage(mileage: number): string {
  return `${String(Math.round(mileage)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} km`;
}

export type ShareCardInput = {
  brandLabel: string;
  modelLabel: string;
  year: number;
  mileage: number | null;
  fuelType: string | null;
  price: number;
  wilayaNameFr: string;
};

export type ShareCard = {
  heading: string; // « Renault Clio »
  details: string; // « 2019 · 60 000 km · Diesel · Alger »
  price: string; // « 1 900 000 DA »
};

export const SHARE_HEADING_MAX = 28;
export const SHARE_DETAILS_MAX = 52;

export function buildShareCard(input: ShareCardInput): ShareCard {
  const heading = truncateLabel(latinSafe(`${input.brandLabel} ${input.modelLabel}`), SHARE_HEADING_MAX);
  const detailParts = [
    String(input.year),
    input.mileage != null && input.mileage > 0 ? formatShareMileage(input.mileage) : "",
    FUEL_LABEL[input.fuelType ?? ""] ?? "",
    latinSafe(input.wilayaNameFr),
  ].filter((part) => part !== "");

  return {
    // Une marque/modèle saisis en arabe donnent un texte vide : « Souq Autos » plutôt qu'un titre vide sur la carte.
    heading: heading === "" ? "Souq Autos" : heading,
    details: truncateLabel(detailParts.join(" · "), SHARE_DETAILS_MAX),
    price: formatSharePrice(input.price),
  };
}
