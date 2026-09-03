// Catalogue initial — marques et modèles réellement commercialisés en Algérie.
// Volontairement limité à des noms de modèles vérifiables (pas de génération/version/
// fiche technique inventée) ; à enrichir progressivement au fil des prochains lots.

export const catalogue: { brand: string; models: string[] }[] = [
  { brand: "Renault", models: ["Clio", "Symbol", "Megane", "Duster", "Kangoo", "Captur", "Talisman"] },
  { brand: "Peugeot", models: ["208", "301", "2008", "3008", "508", "Partner"] },
  { brand: "Dacia", models: ["Logan", "Sandero", "Duster", "Dokker"] },
  { brand: "Volkswagen", models: ["Golf", "Polo", "Passat", "Tiguan", "Touareg"] },
  { brand: "Hyundai", models: ["i10", "i20", "Accent", "Elantra", "Tucson", "Santa Fe"] },
  { brand: "Kia", models: ["Picanto", "Rio", "Cerato", "Sportage", "Sorento"] },
  { brand: "Toyota", models: ["Yaris", "Corolla", "Camry", "RAV4", "Land Cruiser", "Hilux"] },
  { brand: "Fiat", models: ["Panda", "Punto", "Tipo", "500"] },
  { brand: "Citroën", models: ["C3", "C4", "C-Elysée", "Berlingo"] },
  { brand: "Suzuki", models: ["Alto", "Swift", "Vitara", "Jimny"] },
  { brand: "Chevrolet", models: ["Aveo", "Cruze", "Spark"] },
  { brand: "Nissan", models: ["Micra", "Sunny", "Qashqai", "X-Trail"] },
  { brand: "Seat", models: ["Ibiza", "Leon", "Arona"] },
  { brand: "Skoda", models: ["Fabia", "Octavia", "Superb", "Kodiaq"] },
  { brand: "Ford", models: ["Fiesta", "Focus", "Kuga", "Ranger"] },
  { brand: "Opel", models: ["Corsa", "Astra", "Grandland"] },
  { brand: "Mercedes-Benz", models: ["Classe A", "Classe C", "Classe E", "GLA", "GLC", "Sprinter"] },
  { brand: "BMW", models: ["Série 1", "Série 3", "Série 5", "X1", "X3", "X5"] },
  { brand: "Audi", models: ["A3", "A4", "A6", "Q3", "Q5"] },
  { brand: "Chery", models: ["Tiggo 2", "Tiggo 3", "Tiggo 7", "Tiggo 8", "Arrizo 5", "QQ"] },
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
