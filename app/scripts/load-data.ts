// Lot 137 — fabrique des annonces d'allure RÉALISTE pour le test de charge (prisma/seed-load.ts les écrit en base).
//
// Pourquoi « réaliste » compte : une base de 24 annonces répond vite à tout, et ne dit rien de la recherche à 20 000 annonces.
// Les défauts de performance viennent de la FORME des données : marques populaires très représentées (un filtre « Renault
// Clio » ramène des milliers de lignes, « Ferrari » trois), quelques grandes wilayas, des vendeurs professionnels qui
// publient des centaines d'annonces, des prix qui suivent l'âge et le kilométrage, la majorité d'annonces publiées mais aussi
// des expirées, vendues, en attente. Tout est FABRIQUÉ (données de charge jetables, jamais des personnes réelles) et
// reproductible : même graine, mêmes annonces.
// Module pur (aucune base) : testé dans tests/load-data.test.ts.

export type Rand = () => number;

// PRNG déterministe (mulberry32) : le test de charge d'aujourd'hui se compare à celui de demain.
export function mulberry32(seed: number): Rand {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function zipfWeights(count: number, exponent = 1): number[] {
  return Array.from({ length: count }, (_, i) => 1 / Math.pow(i + 1, exponent));
}

// Tirage pondéré par recherche dans les poids cumulés (rapide même pour des milliers d'éléments).
export function weightedPicker<T>(items: readonly T[], weights: readonly number[]): (rand: Rand) => T {
  const cumulative: number[] = [];
  let total = 0;
  for (const weight of weights) cumulative.push((total += weight));
  return (rand) => {
    const target = rand() * total;
    let low = 0;
    let high = cumulative.length - 1;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (cumulative[mid] < target) low = mid + 1;
      else high = mid;
    }
    return items[low];
  };
}

export type CatalogueModel = { id: number; brandId: number; name: string; brandName: string; categories: string[] };
export type Catalogue = {
  models: CatalogueModel[];
  wilayaIds: number[];
  communesByWilaya: Map<number, number[]>;
  equipmentIds: number[];
};

export type ListingRow = {
  id: string;
  sellerId: string;
  category: string;
  brandId: number;
  modelId: number;
  title: string;
  description: string;
  price: number;
  year: number;
  mileage: number;
  fuelType: string;
  gearbox: string;
  condition: string;
  firstHand: boolean;
  accidented: boolean;
  wilayaId: number;
  communeId: number | null;
  formula: string;
  status: string;
  createdAt: Date;
  publishedAt: Date | null;
  expiresAt: Date | null;
};
export type GeneratedListing = { listing: ListingRow; photoCount: number; equipmentIds: number[] };

const DAY = 24 * 60 * 60 * 1000;
const VALIDITY_DAYS = 60;

// Modèles qu'on trouve partout sur le marché algérien : ils reçoivent l'essentiel des annonces.
const POPULAR = new Set(["Clio", "Symbol", "Sandero", "Logan", "208", "301", "Golf", "Tucson", "Accent", "Picanto", "Rio", "Corolla", "Yaris", "Duster", "Polo", "i10", "Elantra", "Megane"]);
// Grandes wilayas (numéros officiels) : Alger, Oran, Constantine, Blida, Sétif, Béjaïa, Tizi Ouzou, Annaba, Batna, Boumerdès.
const BIG_WILAYAS = new Map<number, number>([[16, 14], [31, 9], [25, 6], [9, 6], [19, 5], [6, 5], [15, 5], [23, 4], [5, 4], [35, 4]]);

const CATEGORY_MIX: [string, number][] = [["VOITURE", 80], ["UTILITAIRE", 8], ["DEUX_ROUES", 8], ["POIDS_LOURD", 4]];
const MEDIAN_PRICE: Record<string, number> = { VOITURE: 1_900_000, UTILITAIRE: 2_400_000, DEUX_ROUES: 260_000, POIDS_LOURD: 6_500_000 };
const FUEL_MIX: [string, number][] = [["ESSENCE", 45], ["DIESEL", 40], ["GPL", 8], ["HYBRIDE", 5], ["ELECTRIQUE", 2]];
const STATUS_MIX: [string, number][] = [["PUBLIEE", 82], ["EXPIREE", 6], ["VENDUE", 5], ["EN_ATTENTE", 4], ["SUSPENDUE", 1], ["REFUSEE", 1], ["BROUILLON", 1]];
const TITLE_SUFFIX = ["", "", "", " première main", " full option", " très bon état", " état neuf", " climatisée", " papiers en règle", " kilométrage certifié", " à saisir"];
const DESCRIPTIONS = [
  "Véhicule bien entretenu, carnet d'entretien à jour, aucun accident déclaré. Visible sur rendez-vous, essai possible.",
  "Vendu par le propriétaire, entretien régulier chez le concessionnaire, pneus récents, contrôle technique valide.",
  "Très bon état général, intérieur soigné, moteur en parfait état de marche. Prix légèrement négociable, sérieux uniquement.",
  "Une seule main, jamais accidenté, toutes options d'origine. Papiers en règle, prête à circuler. Contactez-moi pour plus de détails.",
];

const pickFrom = (rand: Rand, mix: [string, number][]) => weightedPicker(mix.map(([v]) => v), mix.map(([, w]) => w))(rand);

export type GeneratorContext = {
  catalogue: Catalogue;
  sellerIds: string[];
  now: number;
  seed?: number;
};

// Fabrique un générateur : les tirages coûteux à préparer (poids des modèles, des wilayas, des vendeurs) le sont UNE fois.
export function createListingGenerator(context: GeneratorContext) {
  const { catalogue, sellerIds, now } = context;
  const rand = mulberry32(context.seed ?? 137);

  const modelsByCategory = new Map<string, { pick: (r: Rand) => CatalogueModel }>();
  for (const [category] of CATEGORY_MIX) {
    const models = catalogue.models.filter((m) => m.categories.includes(category));
    if (models.length === 0) continue;
    // Zipf sur le rang (quelques modèles dominent) ; les modèles populaires sont de plus fortement relevés.
    const zipf = zipfWeights(models.length, 0.9);
    modelsByCategory.set(category, { pick: weightedPicker(models, models.map((m, i) => zipf[i] * (POPULAR.has(m.name) ? 25 : 1))) });
  }
  const categories = CATEGORY_MIX.filter(([c]) => modelsByCategory.has(c));
  if (categories.length === 0) throw new Error("Le catalogue ne contient aucun modèle : lancer d'abord prisma/seed.ts.");

  const pickWilaya = weightedPicker(catalogue.wilayaIds, catalogue.wilayaIds.map((id) => BIG_WILAYAS.get(id) ?? 1));
  // Quelques vendeurs (concessionnaires) publient énormément d'annonces : Zipf sur les vendeurs.
  const pickSeller = weightedPicker(sellerIds, zipfWeights(sellerIds.length, 1.1));
  const currentYear = new Date(now).getFullYear();

  return function generate(index: number): GeneratedListing {
    const category = pickFrom(rand, categories);
    const model = modelsByCategory.get(category)!.pick(rand);
    const isNew = rand() < 0.07;
    const age = isNew ? 0 : Math.min(26, Math.floor(-Math.log(1 - rand() * 0.98) * 7));
    const year = currentYear - age;
    const mileage = isNew ? 0 : Math.round((age * (7_000 + rand() * 20_000) + rand() * 5_000) / 100) * 100;
    // Prix : médiane de la catégorie, dispersion log-normale, décote de 7 % par an, prime du neuf.
    const gaussian = Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
    const base = (MEDIAN_PRICE[category] ?? 1_500_000) * Math.exp(0.65 * gaussian) * Math.pow(0.93, age) * (isNew ? 1.35 : 1);
    const price = Math.max(50_000, Math.round(base / 10_000) * 10_000);

    const status = pickFrom(rand, STATUS_MIX);
    const daysAgo = status === "EXPIREE" ? 62 + rand() * 90 : Math.min(89, -Math.log(1 - rand() * 0.97) * 25);
    const published = status === "BROUILLON" || status === "EN_ATTENTE" ? null : new Date(now - daysAgo * DAY);
    const createdAt = new Date((published ? published.getTime() : now - rand() * 30 * DAY) - rand() * 3 * 60 * 60 * 1000);
    const wilayaId = pickWilaya(rand);
    const communes = catalogue.communesByWilaya.get(wilayaId) ?? [];
    const premium = status === "PUBLIEE" ? rand() : 1;
    const equipmentCount = Math.floor(rand() * 9);
    const equipmentIds = new Set<number>();
    for (let i = 0; i < equipmentCount && catalogue.equipmentIds.length > 0; i++) equipmentIds.add(catalogue.equipmentIds[Math.floor(rand() * catalogue.equipmentIds.length)]);

    const listing: ListingRow = {
      id: `charge-${index.toString(36)}-${Math.floor(rand() * 36 ** 4).toString(36)}`,
      sellerId: pickSeller(rand),
      category,
      brandId: model.brandId,
      modelId: model.id,
      title: `${model.brandName} ${model.name} ${year}${TITLE_SUFFIX[Math.floor(rand() * TITLE_SUFFIX.length)]}`,
      description: DESCRIPTIONS[Math.floor(rand() * DESCRIPTIONS.length)],
      price,
      year,
      mileage,
      fuelType: category === "DEUX_ROUES" ? "ESSENCE" : pickFrom(rand, FUEL_MIX),
      gearbox: rand() < 0.8 ? "MANUELLE" : "AUTOMATIQUE",
      condition: isNew ? "NEUF" : "OCCASION",
      firstHand: rand() < 0.3,
      accidented: rand() < 0.08,
      wilayaId,
      communeId: communes.length > 0 && rand() < 0.6 ? communes[Math.floor(rand() * communes.length)] : null,
      formula: premium > 0.99 ? "PREMIUM_PLUS" : premium > 0.95 ? "PREMIUM" : "STANDARD",
      status,
      createdAt,
      publishedAt: published,
      expiresAt: published ? new Date(published.getTime() + VALIDITY_DAYS * DAY) : null,
    };
    return { listing, photoCount: 1 + Math.floor(rand() * 8), equipmentIds: [...equipmentIds] };
  };
}
