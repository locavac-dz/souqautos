// Catalogue initial — marques et modèles réellement commercialisés en Algérie.
// Volontairement limité à des noms de modèles vérifiables (pas de génération/version/
// fiche technique inventée) ; à enrichir progressivement au fil des prochains lots.
//
// Lot 92 — nameAr (marque) : nom arabe de la marque, vérifié individuellement
// via l'article Wikipédia arabe de la marque concernée (même discipline que
// les générations, Lot 88) — jamais une translittération inventée de
// mémoire. Couverture volontairement PARTIELLE : uniquement les 19 marques
// réellement utilisées par les annonces de démonstration (Lot 71), pas les
// 24 du catalogue.
//
// Lot 94 — un modèle peut aussi porter un nameAr : { name, nameAr } au lieu
// d'une simple chaîne, uniquement pour les 19 modèles à nom propre
// réellement utilisés en démonstration (Wikipédia arabe, + une seconde
// source pour "Tiggo" faute d'article dédié). Les codes alphanumériques
// ("208", "X5", "i20", "Classe C"...) restent volontairement de simples
// chaînes — en usage réel écrits en latin même dans une phrase arabe,
// contrairement aux noms propres.
type CatalogueModel = string | { name: string; nameAr: string };

export const catalogue: { brand: string; nameAr?: string; models: CatalogueModel[] }[] = [
  {
    brand: "Renault",
    nameAr: "رينو",
    models: [
      { name: "Clio", nameAr: "كليو" },
      "Symbol",
      { name: "Megane", nameAr: "ميجان" },
      { name: "Duster", nameAr: "دستر" },
      "Kangoo",
      "Captur",
      "Talisman",
    ],
  },
  { brand: "Peugeot", nameAr: "بيجو", models: ["208", "301", "2008", "3008", "508", "Partner"] },
  {
    brand: "Dacia",
    nameAr: "داسيا",
    models: ["Logan", { name: "Sandero", nameAr: "سانديرو" }, { name: "Duster", nameAr: "دستر" }, "Dokker"],
  },
  {
    brand: "Volkswagen",
    nameAr: "فولكس فاغن",
    models: [{ name: "Golf", nameAr: "غولف" }, "Polo", { name: "Passat", nameAr: "باسات" }, "Tiguan", "Touareg"],
  },
  {
    brand: "Hyundai",
    nameAr: "هيونداي",
    models: [
      "i10",
      "i20",
      "Accent",
      { name: "Elantra", nameAr: "إلنترا" },
      { name: "Tucson", nameAr: "توسان" },
      "Santa Fe",
    ],
  },
  {
    brand: "Kia",
    nameAr: "كيا",
    models: ["Picanto", "Rio", "Cerato", { name: "Sportage", nameAr: "سبورتاج" }, "Sorento"],
  },
  {
    brand: "Toyota",
    nameAr: "تويوتا",
    models: [
      { name: "Yaris", nameAr: "يارس" },
      { name: "Corolla", nameAr: "كورولا" },
      "Camry",
      "RAV4",
      "Land Cruiser",
      "Hilux",
    ],
  },
  { brand: "Fiat", nameAr: "فيات", models: ["Panda", "Punto", { name: "Tipo", nameAr: "تيبو" }, "500"] },
  { brand: "Citroën", nameAr: "ستروين", models: ["C3", "C4", "C-Elysée", "Berlingo"] },
  {
    brand: "Suzuki",
    nameAr: "سوزوكي",
    models: ["Alto", "Swift", { name: "Vitara", nameAr: "فيتارا" }, "Jimny"],
  },
  { brand: "Chevrolet", models: ["Aveo", "Cruze", "Spark"] },
  {
    brand: "Nissan",
    nameAr: "نيسان",
    models: ["Micra", "Sunny", { name: "Qashqai", nameAr: "كاشكاي" }, "X-Trail"],
  },
  { brand: "Seat", nameAr: "سيات", models: [{ name: "Ibiza", nameAr: "إيبيزا" }, "Leon", "Arona"] },
  {
    brand: "Skoda",
    nameAr: "سكودا",
    models: ["Fabia", { name: "Octavia", nameAr: "أوكتافيا" }, "Superb", "Kodiaq"],
  },
  { brand: "Ford", nameAr: "فورد", models: [{ name: "Fiesta", nameAr: "فييستا" }, "Focus", "Kuga", "Ranger"] },
  { brand: "Opel", nameAr: "أوبل", models: [{ name: "Corsa", nameAr: "كورسا" }, "Astra", "Grandland"] },
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
    models: [
      "Tiggo 2",
      "Tiggo 3",
      // "تيجو" seul (sans le chiffre) matcherait aussi "تيجو 3"/"تيجو 8" —
      // jamais vérifié individuellement pour ces variantes, contrairement à
      // Tiggo 7 (confirmé via plusieurs sites automobiles réels, cf.
      // CHANGELOG Lot 94/correctif). Inclure le chiffre dans nameAr évite un
      // modèle deviné plutôt que reconnu.
      { name: "Tiggo 7", nameAr: "تيجو 7" },
      "Tiggo 8",
      "Arrizo 5",
      "QQ",
    ],
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
