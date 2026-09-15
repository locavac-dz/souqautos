// Recherche en langage naturel (§ cahier d'architecture, phase V3 « recherche
// langage naturel ») — même principe honnête que la suggestion de titre/
// description (Lot 57) : vrai appel Anthropic si ANTHROPIC_API_KEY est
// configurée, sinon repli heuristique qui fait EXACTEMENT ce que faisait déjà
// la barre de recherche avant ce lot (recherche texte simple sur `q`) — donc
// aucune régression pour les visiteurs de ce site tant qu'aucune clé n'est
// fournie.

export type ParsedSearchFilters = Partial<
  Record<
    | "q"
    | "category"
    | "brandId"
    | "modelId"
    | "wilayaId"
    | "priceMin"
    | "priceMax"
    | "yearMin"
    | "yearMax"
    | "fuelType"
    | "gearbox"
    | "condition",
    string
  >
>;

export type CatalogBrand = { id: number; name: string; models: { id: number; name: string }[] };
export type CatalogWilaya = { id: number; nomFr: string };

const CATEGORIES = ["VOITURE", "UTILITAIRE", "POIDS_LOURD", "DEUX_ROUES", "AUTRE"];
const FUEL_TYPES = ["ESSENCE", "DIESEL", "GPL", "HYBRIDE", "ELECTRIQUE"];
const GEARBOXES = ["MANUELLE", "AUTOMATIQUE"];
const CONDITIONS = ["NEUF", "OCCASION"];

// Ne fait JAMAIS confiance aux ids renvoyés par le modèle : chaque id doit
// exister réellement dans le catalogue fourni, sinon le champ est ignoré
// plutôt que de risquer un filtre incohérent (ex: un brandId halluciné).
export function sanitizeParsedFilters(
  raw: unknown,
  catalog: { brands: CatalogBrand[]; wilayas: CatalogWilaya[] }
): ParsedSearchFilters {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  const out: ParsedSearchFilters = {};

  const brandIds = new Set(catalog.brands.map((b) => b.id));
  const modelIds = new Set(catalog.brands.flatMap((b) => b.models.map((m) => m.id)));
  const wilayaIds = new Set(catalog.wilayas.map((w) => w.id));

  if (typeof r.brandId === "number" && brandIds.has(r.brandId)) out.brandId = String(r.brandId);
  if (typeof r.modelId === "number" && modelIds.has(r.modelId)) out.modelId = String(r.modelId);
  if (typeof r.wilayaId === "number" && wilayaIds.has(r.wilayaId)) out.wilayaId = String(r.wilayaId);
  if (typeof r.category === "string" && CATEGORIES.includes(r.category)) out.category = r.category;
  if (typeof r.fuelType === "string" && FUEL_TYPES.includes(r.fuelType)) out.fuelType = r.fuelType;
  if (typeof r.gearbox === "string" && GEARBOXES.includes(r.gearbox)) out.gearbox = r.gearbox;
  if (typeof r.condition === "string" && CONDITIONS.includes(r.condition)) out.condition = r.condition;
  if (typeof r.priceMin === "number" && r.priceMin > 0) out.priceMin = String(Math.round(r.priceMin));
  if (typeof r.priceMax === "number" && r.priceMax > 0) out.priceMax = String(Math.round(r.priceMax));
  if (typeof r.yearMin === "number" && r.yearMin > 1900) out.yearMin = String(Math.round(r.yearMin));
  if (typeof r.yearMax === "number" && r.yearMax > 1900) out.yearMax = String(Math.round(r.yearMax));
  if (typeof r.q === "string" && r.q.trim()) out.q = r.q.trim();

  return out;
}

async function callAnthropic(
  query: string,
  catalog: { brands: CatalogBrand[]; wilayas: CatalogWilaya[] }
): Promise<ParsedSearchFilters | null> {
  const brandList = catalog.brands.map((b) => `${b.id}:${b.name}`).join(", ");
  const modelList = catalog.brands
    .flatMap((b) => b.models.map((m) => `${m.id}:${b.name} ${m.name}`))
    .join(", ");
  const wilayaList = catalog.wilayas.map((w) => `${w.id}:${w.nomFr}`).join(", ");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 300,
      system: `Tu extrais des critères de recherche de véhicule d'occasion depuis une phrase en français ou en arabe algérien, pour la plateforme Souq Auto. Réponds UNIQUEMENT avec un objet JSON, sans aucun texte autour, ne contenant QUE les clés dont tu es raisonnablement certain (omets toute clé incertaine) parmi : brandId (nombre, choisi EXACTEMENT dans cette liste id:nom — ${brandList}), modelId (nombre, choisi EXACTEMENT dans cette liste id:marque modèle — ${modelList} — uniquement si la marque correspondante est aussi identifiée), wilayaId (nombre, choisi EXACTEMENT dans cette liste id:nom — ${wilayaList}), category (une valeur EXACTE parmi ${CATEGORIES.join(", ")}), fuelType (${FUEL_TYPES.join(", ")}), gearbox (${GEARBOXES.join(", ")}), condition (${CONDITIONS.join(", ")}), priceMin/priceMax (nombres en dinars algériens), yearMin/yearMax (années). N'invente JAMAIS un id absent des listes fournies — omets le champ plutôt que d'approximer. Si la phrase contient un terme de recherche libre non couvert par ces champs (ex: un mot dans le titre de l'annonce), inclus-le dans "q", sinon omets "q".`,
      messages: [{ role: "user", content: query }],
    }),
  });

  if (!res.ok) return null;

  const data = (await res.json()) as { content?: { text?: string }[] };
  const text = data.content?.[0]?.text;
  if (!text) return null;

  const parsed = JSON.parse(text);
  return sanitizeParsedFilters(parsed, catalog);
}

export async function parseNaturalLanguageQuery(
  query: string,
  catalog: { brands: CatalogBrand[]; wilayas: CatalogWilaya[] }
): Promise<{ filters: ParsedSearchFilters; source: "ai" | "heuristic" }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { filters: { q: query }, source: "heuristic" };
  }

  try {
    const ai = await callAnthropic(query, catalog);
    if (ai && Object.keys(ai).length > 0) return { filters: ai, source: "ai" };
  } catch (err) {
    console.error(`[AI search] échec du parsing, repli texte simple: ${(err as Error).message}`);
  }

  return { filters: { q: query }, source: "heuristic" };
}
