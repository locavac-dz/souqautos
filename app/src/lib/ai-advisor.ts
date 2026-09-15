import { sanitizeParsedFilters, type ParsedSearchFilters, type CatalogBrand, type CatalogWilaya } from "./ai-search";

// Lot 89 — AI Advisor (§ cahier d'architecture, phase V3 « AI Advisor/Buyer »).
// Découverte guidée en conversation multi-tours : à chaque tour, un seul
// appel Anthropic (même patron que les Lots 57/58/85) décide soit de poser
// UNE question de clarification, soit de lancer une recherche. Contrairement
// à la comparaison assistée (Lot 85), l'IA ne rédige JAMAIS de texte au sujet
// d'une annonce précise — son seul texte libre est la question de
// clarification, posée AVANT toute recherche. Les annonces montrées viennent
// toujours d'une vraie requête Prisma exécutée côté route API, jamais de
// l'IA — l'absence de fabrication est garantie par construction (le schéma
// de réponse de l'IA ne contient aucun champ où décrire une annonce), pas
// par confiance dans le modèle.

export type AdvisorMessage = { role: "user" | "assistant"; content: string };

export type AdvisorCatalog = { brands: CatalogBrand[]; wilayas: CatalogWilaya[] };

export type AdvisorTurnResult = {
  action: "clarify" | "search";
  filters: ParsedSearchFilters;
  // Texte de la question — seulement en mode IA (Anthropic formule sa propre
  // question). En repli heuristique, toujours null : la route API affiche
  // alors une question fixe traduite (AiAdvisor.heuristicClarify), seule
  // dégradation honnête possible sans raisonnement réel.
  question: string | null;
  source: "ai" | "heuristic";
};

const FUEL_KEYWORDS: Record<string, string> = {
  essence: "ESSENCE",
  diesel: "DIESEL",
  gpl: "GPL",
  hybride: "HYBRIDE",
  électrique: "ELECTRIQUE",
  electrique: "ELECTRIQUE",
};
const GEARBOX_KEYWORDS: Record<string, string> = {
  automatique: "AUTOMATIQUE",
  manuelle: "MANUELLE",
};
const CONDITION_KEYWORDS: Record<string, string> = {
  neuf: "NEUF",
  occasion: "OCCASION",
};

function findKeyword(text: string, keywords: Record<string, string>): string | undefined {
  for (const [keyword, value] of Object.entries(keywords)) {
    if (text.includes(keyword)) return value;
  }
  return undefined;
}

// "1.5 million"/"1,5 million"/"800 000 da"/"2000000 DA" → un montant en DA.
// Repli volontairement simple (jamais une tentative de comprendre une
// fourchette min/max en texte libre) : seul priceMax est extrait, cohérent
// avec l'usage courant ("moins de X") plutôt qu'un budget exact.
function extractPriceMax(text: string): number | undefined {
  const millionMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(?:millions?|mda)\b/);
  if (millionMatch) {
    return Math.round(parseFloat(millionMatch[1].replace(",", ".")) * 1_000_000);
  }
  const plainMatch = text.match(/(\d[\d\s]{4,})\s*(?:da|dinars?)\b/);
  if (plainMatch) {
    const value = Number(plainMatch[1].replace(/\s/g, ""));
    return Number.isFinite(value) && value > 0 ? value : undefined;
  }
  return undefined;
}

function extractYearMin(text: string): number | undefined {
  const match = text.match(/\b(19\d{2}|20\d{2})\b/);
  return match ? Number(match[1]) : undefined;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findCatalogMatch<T extends { name?: string; nomFr?: string }>(
  text: string,
  entries: T[],
  getLabel: (entry: T) => string
): T | undefined {
  return entries.find((entry) => {
    const label = getLabel(entry).toLowerCase();
    if (label.length < 2) return false;
    return new RegExp(`\\b${escapeRegExp(label)}\\b`, "i").test(text);
  });
}

// Cœur pur et déterministe du repli sans clé Anthropic — jamais un stub :
// extraction par mots-clés/sous-chaînes, cumulée sur tous les messages
// utilisateur de la conversation (pour ne pas perdre le contexte d'un tour
// à l'autre même sans raisonnement IA réel).
function extractFiltersFromText(
  text: string,
  catalog: AdvisorCatalog
): Record<string, unknown> {
  const lower = text.toLowerCase();
  const raw: Record<string, unknown> = {};

  const brand = findCatalogMatch(lower, catalog.brands, (b) => b.name);
  if (brand) {
    raw.brandId = brand.id;
    const model = findCatalogMatch(lower, brand.models, (m) => m.name);
    if (model) raw.modelId = model.id;
  }

  const wilaya = findCatalogMatch(lower, catalog.wilayas, (w) => w.nomFr);
  if (wilaya) raw.wilayaId = wilaya.id;

  const fuelType = findKeyword(lower, FUEL_KEYWORDS);
  if (fuelType) raw.fuelType = fuelType;

  const gearbox = findKeyword(lower, GEARBOX_KEYWORDS);
  if (gearbox) raw.gearbox = gearbox;

  const condition = findKeyword(lower, CONDITION_KEYWORDS);
  if (condition) raw.condition = condition;

  const priceMax = extractPriceMax(lower);
  if (priceMax) raw.priceMax = priceMax;

  const yearMin = extractYearMin(lower);
  if (yearMin) raw.yearMin = yearMin;

  return raw;
}

export function runHeuristicTurn(messages: AdvisorMessage[], catalog: AdvisorCatalog): AdvisorTurnResult {
  const userMessages = messages.filter((m) => m.role === "user").map((m) => m.content);
  const lastUserMessage = userMessages[userMessages.length - 1] ?? "";
  const hasPriorAssistantMessage = messages.some((m) => m.role === "assistant");

  const structured = sanitizeParsedFilters(extractFiltersFromText(userMessages.join(" "), catalog), catalog);
  const hasStructuredCriteria = Object.keys(structured).length > 0;

  if (!hasPriorAssistantMessage && !hasStructuredCriteria) {
    return { action: "clarify", filters: {}, question: null, source: "heuristic" };
  }

  // Un critère structuré trouvé combiné à un texte libre complet donnerait un
  // ET impossible à satisfaire (le titre ne contient jamais la phrase entière
  // de l'acheteur) — le texte libre n'est donc un résidu QUE quand aucun
  // critère structuré n'a été trouvé, jamais en plus d'eux. Même discipline
  // que le repli { q: query } de ai-search.ts (Lot 58).
  const filters = hasStructuredCriteria ? structured : sanitizeParsedFilters({ q: lastUserMessage }, catalog);

  return { action: "search", filters, question: null, source: "heuristic" };
}

async function callAnthropicForTurn(
  messages: AdvisorMessage[],
  catalog: AdvisorCatalog,
  locale: string
): Promise<AdvisorTurnResult | null> {
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
      max_tokens: 400,
      system: `Tu es un conseiller d'achat automobile pour la plateforme Souq Auto (Algérie), en conversation avec un acheteur qui cherche un véhicule. À chaque tour, décide : soit poser UNE SEULE question de clarification si, sur l'ensemble de la conversation, moins de deux critères significatifs sont connus (marque/catégorie, budget, wilaya...), soit lancer une recherche dès que tu en sais assez. Critères disponibles : brandId (nombre, choisi EXACTEMENT dans cette liste id:nom — ${brandList}), modelId (nombre, choisi EXACTEMENT dans cette liste id:marque modèle — ${modelList} — uniquement si la marque correspondante est aussi identifiée), wilayaId (nombre, choisi EXACTEMENT dans cette liste id:nom — ${wilayaList}), category (VOITURE, UTILITAIRE, POIDS_LOURD, DEUX_ROUES, AUTRE), fuelType (ESSENCE, DIESEL, GPL, HYBRIDE, ELECTRIQUE), gearbox (MANUELLE, AUTOMATIQUE), condition (NEUF, OCCASION), priceMin/priceMax (nombres en dinars algériens), yearMin/yearMax (années). N'invente JAMAIS un id absent des listes fournies — omets le critère plutôt que d'approximer. Tu n'as accès à AUCUNE donnée d'annonce réelle : ne mentionne, ne décris et ne compare JAMAIS une annonce précise, ce serait une invention. Réponds UNIQUEMENT avec un objet JSON de la forme {"action": "clarify"|"search", "filters": {tous les critères comprises jusqu'ici, cumulés sur toute la conversation}, "question": string|null} — "question" rempli uniquement si action="clarify", une seule question courte et naturelle en ${locale === "ar" ? "arabe" : "français"} portant sur les critères de recherche (jamais sur une annonce), sinon null. Aucun texte hors de ce JSON.`,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });

  if (!res.ok) return null;

  const data = (await res.json()) as { content?: { text?: string }[] };
  const text = data.content?.[0]?.text;
  if (!text) return null;

  const parsed = JSON.parse(text) as { action?: unknown; filters?: unknown; question?: unknown };
  if (parsed.action !== "clarify" && parsed.action !== "search") return null;

  const filters = sanitizeParsedFilters(parsed.filters, catalog);
  const question = typeof parsed.question === "string" && parsed.question.trim() ? parsed.question.trim().slice(0, 500) : null;

  // Une clarification sans question réelle n'a rien à afficher — garbage,
  // traité comme un échec (repli heuristique par l'appelant).
  if (parsed.action === "clarify" && !question) return null;

  return { action: parsed.action, filters, question, source: "ai" };
}

export async function runAdvisorTurn(
  messages: AdvisorMessage[],
  catalog: AdvisorCatalog,
  locale: string
): Promise<AdvisorTurnResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return runHeuristicTurn(messages, catalog);
  }

  try {
    const ai = await callAnthropicForTurn(messages, catalog, locale);
    if (ai) return ai;
  } catch (err) {
    console.error(`[AI advisor] échec du tour, repli heuristique: ${(err as Error).message}`);
  }

  return runHeuristicTurn(messages, catalog);
}
