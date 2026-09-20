import type { ListingCategory } from "@prisma/client";

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
//
// Lot 130 — utilitaires, poids lourds et deux-roues. Chaque MODÈLE porte ses catégories d'annonce
// (`categories`, voiture par défaut) : un Kangoo se vend comme voiture ou comme utilitaire, un Actros
// comme poids lourd. Une MARQUE peut fixer une valeur par défaut pour tous ses modèles (marques de motos,
// de camions) ; sa catégorie se déduit de ses modèles, elle n'est jamais saisie à part.
// Les noms de modèles sont ceux des gammes publiques des constructeurs, choisis parmi les plus courants :
// liste NON exhaustive, à compléter par l'administration (/admin/referentiels). Les noms de marques et de
// modèles ajoutés à ce lot n'ont PAS de nameAr : ils s'écrivent en latin, comme les codes alphanumériques
// ci-dessus, tant qu'un locuteur natif n'a pas validé une écriture arabe.
// Vérifié en ligne pour ce lot : la gamme des camions SNVI (fr.wikipedia.org/wiki/SNVI) et la présence
// de Shacman (modèle F3000) sur le marché algérien ; le reste vient de la connaissance générale des gammes.
type CatalogueModel = string | { name: string; nameAr?: string; categories?: ListingCategory[] };
export type CatalogueBrand = { brand: string; nameAr?: string; categories?: ListingCategory[]; models: CatalogueModel[] };

export const DEFAULT_MODEL_CATEGORIES: ListingCategory[] = ["VOITURE"];

// Catégories effectives d'un modèle : les siennes, sinon celles de sa marque, sinon « voiture ».
export function modelCategories(entry: { categories?: ListingCategory[] }, model: CatalogueModel): ListingCategory[] {
  if (typeof model !== "string" && model.categories) return model.categories;
  return entry.categories ?? DEFAULT_MODEL_CATEGORIES;
}

const U: ListingCategory[] = ["UTILITAIRE"];
const VU: ListingCategory[] = ["VOITURE", "UTILITAIRE"];
const PL: ListingCategory[] = ["POIDS_LOURD"];
const UPL: ListingCategory[] = ["UTILITAIRE", "POIDS_LOURD"];
const MOTO: ListingCategory[] = ["DEUX_ROUES"];
const van = (name: string) => ({ name, categories: U });
const carOrVan = (name: string) => ({ name, categories: VU });
const truck = (name: string) => ({ name, categories: PL });
const vanOrTruck = (name: string) => ({ name, categories: UPL });
const bike = (name: string) => ({ name, categories: MOTO });

export const catalogue: CatalogueBrand[] = [
  {
    brand: "Renault",
    nameAr: "رينو",
    models: [
      { name: "Clio", nameAr: "كليو" },
      "Symbol",
      { name: "Megane", nameAr: "ميجان" },
      { name: "Duster", nameAr: "دستر" },
      carOrVan("Kangoo"),
      van("Trafic"),
      van("Master"),
      "Captur",
      "Talisman",
    ],
  },
  { brand: "Peugeot", nameAr: "بيجو", models: ["208", "301", "2008", "3008", "508", carOrVan("Partner"), van("Expert"), van("Boxer"), van("Bipper")] },
  {
    brand: "Dacia",
    nameAr: "داسيا",
    models: ["Logan", { name: "Sandero", nameAr: "سانديرو" }, { name: "Duster", nameAr: "دستر" }, carOrVan("Dokker"), van("Logan Pick-up")],
  },
  {
    brand: "Volkswagen",
    nameAr: "فولكس فاغن",
    models: [{ name: "Golf", nameAr: "غولف" }, "Polo", { name: "Passat", nameAr: "باسات" }, "Tiguan", "Touareg", carOrVan("Caddy"), van("Transporter"), van("Crafter"), carOrVan("Amarok")],
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
      carOrVan("H-1"),
      van("H100"),
      truck("Mighty"),
      truck("Xcient"),
    ],
  },
  {
    brand: "Kia",
    nameAr: "كيا",
    models: ["Picanto", "Rio", "Cerato", { name: "Sportage", nameAr: "سبورتاج" }, "Sorento", van("K2700")],
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
      carOrVan("Hilux"),
      van("Hiace"),
      van("Dyna"),
    ],
  },
  { brand: "Fiat", nameAr: "فيات", models: ["Panda", "Punto", { name: "Tipo", nameAr: "تيبو" }, "500", carOrVan("Doblò"), carOrVan("Fiorino"), van("Ducato"), van("Scudo")] },
  { brand: "Citroën", nameAr: "ستروين", models: ["C3", "C4", "C-Elysée", carOrVan("Berlingo"), van("Jumpy"), van("Jumper"), van("C15"), van("Nemo")] },
  {
    brand: "Suzuki",
    nameAr: "سوزوكي",
    models: ["Alto", "Swift", { name: "Vitara", nameAr: "فيتارا" }, "Jimny",
      van("Carry"),
      bike("Hayabusa"),
      bike("GSX-R600"),
      bike("GSX-R750"),
      bike("GSX-R1000"),
      bike("GSX-S1000"),
      bike("V-Strom 650"),
      bike("V-Strom 1000"),
      bike("SV650"),
      bike("Burgman 125"),
      bike("Burgman 400"),
    ],
  },
  { brand: "Chevrolet", models: ["Aveo", "Cruze", "Spark"] },
  {
    brand: "Nissan",
    nameAr: "نيسان",
    models: ["Micra", "Sunny", { name: "Qashqai", nameAr: "كاشكاي" }, "X-Trail", carOrVan("Navara"), van("NV200"), van("Cabstar")],
  },
  { brand: "Seat", nameAr: "سيات", models: [{ name: "Ibiza", nameAr: "إيبيزا" }, "Leon", "Arona"] },
  {
    brand: "Skoda",
    nameAr: "سكودا",
    models: ["Fabia", { name: "Octavia", nameAr: "أوكتافيا" }, "Superb", "Kodiaq"],
  },
  { brand: "Ford", nameAr: "فورد", models: [{ name: "Fiesta", nameAr: "فييستا" }, "Focus", "Kuga", carOrVan("Ranger"), van("Transit"), van("Transit Connect"), van("Transit Custom")] },
  { brand: "Opel", nameAr: "أوبل", models: [{ name: "Corsa", nameAr: "كورسا" }, "Astra", "Grandland", carOrVan("Combo"), van("Vivaro"), van("Movano")] },
  {
    brand: "Mercedes-Benz",
    nameAr: "مرسيدس-بنز",
    models: [
      "Classe A",
      "Classe C",
      "Classe E",
      "GLA",
      "GLC",
      van("Sprinter"),
      van("Vito"),
      van("Citan"),
      truck("Actros"),
      truck("Arocs"),
      truck("Atego"),
      truck("Axor"),
      truck("Antos"),
      truck("Unimog"),
    ],
  },
  { brand: "BMW", nameAr: "بي إم دبليو", models: [
      "Série 1",
      "Série 3",
      "Série 5",
      "X1",
      "X3",
      "X5",
      bike("G 310 R"),
      bike("G 310 GS"),
      bike("F 750 GS"),
      bike("F 850 GS"),
      bike("R 1200 GS"),
      bike("R 1250 GS"),
      bike("S 1000 RR"),
      bike("S 1000 R"),
      bike("R nineT"),
      bike("C 400 X"),
    ],
  },
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
  { brand: "Volvo", models: ["XC40", "XC60", "S60", truck("FH"), truck("FM"), truck("FMX"), truck("FE"), truck("FL")] },
  { brand: "Mitsubishi", models: ["Lancer", "Pajero", "ASX", carOrVan("L200")] },

  // --- Lot 130 : utilitaires et poids lourds ---
  {
    brand: "Iveco",
    models: [van("Daily"), truck("Eurocargo"), truck("Stralis"), truck("Trakker"), truck("S-Way"), truck("T-Way")],
  },
  { brand: "Isuzu", models: [carOrVan("D-Max"), van("NLR"), truck("NPR"), truck("NQR"), truck("FVR"), truck("Giga")] },
  { brand: "Mitsubishi Fuso", models: [vanOrTruck("Canter"), truck("Fighter"), truck("Super Great")] },
  { brand: "Hino", models: [vanOrTruck("300"), truck("500"), truck("700")] },
  {
    brand: "Renault Trucks",
    categories: PL,
    models: ["Premium", "Kerax", "Midlum", "Magnum", "Gamme T", "Gamme C", "Gamme K", "Gamme D", van("Maxity")],
  },
  { brand: "Scania", categories: PL, models: ["Série R", "Série S", "Série G", "Série P"] },
  { brand: "MAN", models: [truck("TGX"), truck("TGS"), truck("TGM"), truck("TGL"), truck("TGA"), van("TGE")] },
  { brand: "DAF", categories: PL, models: ["XF", "XG", "CF", "LF"] },
  { brand: "Ford Trucks", categories: PL, models: ["F-MAX", "Cargo"] },
  { brand: "Sinotruk", categories: PL, models: ["Howo", "Sitrak"] },
  { brand: "Shacman", categories: PL, models: ["F3000", "L3000", "M3000", "X3000"] },
  { brand: "FAW", models: [truck("J6"), van("Tiger V")] },
  { brand: "Dongfeng", models: [truck("Kinland"), vanOrTruck("Captain"), carOrVan("Rich")] },
  { brand: "Foton", models: [truck("Auman"), vanOrTruck("Aumark"), carOrVan("Tunland"), van("View")] },
  { brand: "JAC", models: [carOrVan("T6"), carOrVan("T8"), van("Sunray"), vanOrTruck("N56"), vanOrTruck("N75")] },
  { brand: "Tata", models: [carOrVan("Xenon"), van("Ace"), truck("LPT"), truck("Prima"), truck("Signa")] },
  { brand: "Great Wall", categories: VU, models: ["Wingle 5", "Wingle 7"] },
  { brand: "Kamaz", categories: PL, models: ["5320", "43118", "6520", "65115"] },
  // SNVI (Société nationale de véhicules industriels, Rouiba) — gamme de camions relevée sur fr.wikipedia.org/wiki/SNVI.
  { brand: "SNVI", categories: PL, models: ["K66", "K120", "B260", "B400", "C260", "M120", "M230", "M260", "M350", "TB400", "TC260"] },

  // --- Lot 130 : deux-roues ---
  {
    brand: "Yamaha",
    categories: MOTO,
    models: ["MT-03", "MT-07", "MT-09", "YZF-R3", "YZF-R6", "YZF-R1", "Tracer 9", "Ténéré 700", "XMAX", "NMAX", "TMAX", "Aerox", "YBR125"],
  },
  {
    brand: "Honda",
    categories: MOTO,
    models: ["CB125F", "CB500F", "CB650R", "CBR500R", "CBR650R", "CBR1000RR", "Africa Twin", "Transalp", "NC750X", "X-ADV", "Forza 125", "Forza 350", "PCX 125", "SH 125i", "SH 350i", "Rebel 500", "CRF250L", "Gold Wing"],
  },
  {
    brand: "Kawasaki",
    categories: MOTO,
    models: ["Ninja 400", "Ninja 650", "Ninja ZX-6R", "Ninja ZX-10R", "Z650", "Z900", "Versys 650", "Versys 1000", "Vulcan S", "W800"],
  },
  { brand: "Piaggio", categories: MOTO, models: ["Liberty", "Beverly", "Medley", "MP3", "Zip", "Fly"] },
  { brand: "Vespa", categories: MOTO, models: ["Primavera", "Sprint", "GTS", "LX", "PX"] },
  { brand: "Peugeot Motocycles", categories: MOTO, models: ["Django", "Speedfight", "Kisbee", "Tweet", "Ludix", "Citystar"] },
  { brand: "MBK", categories: MOTO, models: ["Booster", "Ovetto", "Stunt", "Nitro"] },
  { brand: "Kymco", categories: MOTO, models: ["Agility", "People", "Like", "Downtown", "Xciting", "AK 550", "Super 8"] },
  { brand: "SYM", categories: MOTO, models: ["Symphony", "Jet 14", "Orbit", "Fiddle", "Cruisym", "Maxsym"] },
  { brand: "TVS", categories: MOTO, models: ["Apache RTR 160", "Apache RTR 200", "Jupiter", "NTORQ", "Star City", "Raider 125"] },
  { brand: "Bajaj", categories: MOTO, models: ["Pulsar 150", "Pulsar NS200", "Dominar 400", "Boxer", "Platina", "Avenger"] },
  {
    brand: "Royal Enfield",
    categories: MOTO,
    models: ["Classic 350", "Bullet 350", "Meteor 350", "Hunter 350", "Himalayan", "Interceptor 650", "Continental GT 650"],
  },
  { brand: "Benelli", categories: MOTO, models: ["TNT 125", "TNT 300", "TRK 502", "Leoncino 500", "Imperiale 400", "502C"] },
  { brand: "CFMoto", categories: MOTO, models: ["250SR", "300NK", "450SR", "650NK", "650MT", "800MT", "Papio"] },
  {
    brand: "KTM",
    categories: MOTO,
    models: ["Duke 125", "Duke 200", "Duke 390", "790 Duke", "890 Duke", "RC 390", "390 Adventure", "1290 Super Duke R"],
  },
  {
    brand: "Ducati",
    categories: MOTO,
    models: ["Monster", "Scrambler", "Panigale V2", "Panigale V4", "Streetfighter V4", "Multistrada V4", "Diavel", "Hypermotard 950", "DesertX"],
  },
  {
    brand: "Harley-Davidson",
    categories: MOTO,
    models: ["Iron 883", "Forty-Eight", "Sportster S", "Fat Boy", "Fat Bob", "Road King", "Street Glide", "Pan America 1250"],
  },
  {
    brand: "Triumph",
    categories: MOTO,
    models: ["Trident 660", "Street Triple", "Speed Triple", "Speed 400", "Tiger 900", "Tiger 1200", "Bonneville T100", "Bonneville T120", "Scrambler 900", "Rocket 3"],
  },
  { brand: "Aprilia", categories: MOTO, models: ["RS 125", "RS 660", "Tuono 660", "RSV4", "SR GT 200", "Scarabeo", "Tuareg 660"] },
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
