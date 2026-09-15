// Catalogue initial — marques et modèles réellement commercialisés en Algérie.
// Volontairement limité à des noms de modèles vérifiables (pas de génération/version/
// fiche technique inventée) ; à enrichir progressivement au fil des prochains lots.
//
// Lot 92 — nameAr : nom arabe de la marque, vérifié individuellement via
// l'article Wikipédia arabe de la marque concernée (même discipline que les
// générations, Lot 88) — jamais une translittération inventée de mémoire.
// Couverture volontairement PARTIELLE : uniquement les 19 marques
// réellement utilisées par les annonces de démonstration (Lot 71), pas les
// 24 du catalogue. Modèles non couverts (hors périmètre de ce lot) : la
// plupart restent en usage réel écrits en graphie latine même dans une
// phrase arabe (codes alphanumériques comme "208"/"X5"/"i20"), contrairement
// aux noms de marque.
export const catalogue: { brand: string; nameAr?: string; models: string[] }[] = [
  { brand: "Renault", nameAr: "رينو", models: ["Clio", "Symbol", "Megane", "Duster", "Kangoo", "Captur", "Talisman"] },
  { brand: "Peugeot", nameAr: "بيجو", models: ["208", "301", "2008", "3008", "508", "Partner"] },
  { brand: "Dacia", nameAr: "داسيا", models: ["Logan", "Sandero", "Duster", "Dokker"] },
  { brand: "Volkswagen", nameAr: "فولكس فاغن", models: ["Golf", "Polo", "Passat", "Tiguan", "Touareg"] },
  { brand: "Hyundai", nameAr: "هيونداي", models: ["i10", "i20", "Accent", "Elantra", "Tucson", "Santa Fe"] },
  { brand: "Kia", nameAr: "كيا", models: ["Picanto", "Rio", "Cerato", "Sportage", "Sorento"] },
  { brand: "Toyota", nameAr: "تويوتا", models: ["Yaris", "Corolla", "Camry", "RAV4", "Land Cruiser", "Hilux"] },
  { brand: "Fiat", nameAr: "فيات", models: ["Panda", "Punto", "Tipo", "500"] },
  { brand: "Citroën", nameAr: "ستروين", models: ["C3", "C4", "C-Elysée", "Berlingo"] },
  { brand: "Suzuki", nameAr: "سوزوكي", models: ["Alto", "Swift", "Vitara", "Jimny"] },
  { brand: "Chevrolet", models: ["Aveo", "Cruze", "Spark"] },
  { brand: "Nissan", nameAr: "نيسان", models: ["Micra", "Sunny", "Qashqai", "X-Trail"] },
  { brand: "Seat", nameAr: "سيات", models: ["Ibiza", "Leon", "Arona"] },
  { brand: "Skoda", nameAr: "سكودا", models: ["Fabia", "Octavia", "Superb", "Kodiaq"] },
  { brand: "Ford", nameAr: "فورد", models: ["Fiesta", "Focus", "Kuga", "Ranger"] },
  { brand: "Opel", nameAr: "أوبل", models: ["Corsa", "Astra", "Grandland"] },
  {
    brand: "Mercedes-Benz",
    nameAr: "مرسيدس-بنز",
    models: ["Classe A", "Classe C", "Classe E", "GLA", "GLC", "Sprinter"],
  },
  { brand: "BMW", nameAr: "بي إم دبليو", models: ["Série 1", "Série 3", "Série 5", "X1", "X3", "X5"] },
  { brand: "Audi", nameAr: "أودي", models: ["A3", "A4", "A6", "Q3", "Q5"] },
  {
    brand: "Chery",
    nameAr: "شيري",
    models: ["Tiggo 2", "Tiggo 3", "Tiggo 7", "Tiggo 8", "Arrizo 5", "QQ"],
  },
  { brand: "Geely", models: ["Emgrand", "Coolray", "Azkarra"] },
  { brand: "Haval", models: ["H6", "Jolion", "H2"] },
  { brand: "Volvo", models: ["XC40", "XC60", "S60"] },
  { brand: "Mitsubishi", models: ["Lancer", "Pajero", "ASX", "L200"] },
];

const COMBINING_DIACRITICS = new RegExp(
  String.fromCharCode(0x5b) + String.fromCharCode(0x300) + "-" + String.fromCharCode(0x36f) + String.fromCharCode(0x5d),
  "g"
);

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(COMBINING_DIACRITICS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
