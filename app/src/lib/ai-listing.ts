import type { ListingSuggestionInput } from "./validation/listing-suggestion";
import { callAnthropicMessages } from "./anthropic-client";

// Suggestion de titre/description à l'étape 7 de l'assistant de publication
// (§ cahier d'architecture, phase V3 « AI Listing »). Comme l'Assistant IA de
// Programmation Architecturale (autre app du groupe) : un vrai appel à
// l'API Anthropic si ANTHROPIC_API_KEY est configurée, sinon un repli
// heuristique honnête (gabarit déterministe à partir des champs déjà
// saisis) — jamais une fabrication IA simulée. Le repli n'invente jamais une
// caractéristique non fournie, contrairement à ce qu'un LLM sans contrainte
// pourrait faire.

const FUEL_LABEL_FR: Record<string, string> = {
  ESSENCE: "essence",
  DIESEL: "diesel",
  GPL: "GPL",
  HYBRIDE: "hybride",
  ELECTRIQUE: "électrique",
};
const GEARBOX_LABEL_FR: Record<string, string> = {
  MANUELLE: "boîte manuelle",
  AUTOMATIQUE: "boîte automatique",
};
const CONDITION_LABEL_FR: Record<string, string> = { NEUF: "neuf", OCCASION: "occasion" };

export function generateHeuristicSuggestion(input: ListingSuggestionInput): {
  title: string;
  description: string;
} {
  const vehicle = input.model ? `${input.brand} ${input.model}` : input.brand;
  const fuel = FUEL_LABEL_FR[input.fuelType] ?? input.fuelType;
  const condition = CONDITION_LABEL_FR[input.condition] ?? input.condition;
  const gearbox = GEARBOX_LABEL_FR[input.gearbox] ?? input.gearbox;

  const title = `${vehicle} ${input.year}, ${fuel}, ${condition}`.slice(0, 120);

  const sentences: string[] = [
    `${vehicle} de ${input.year}, motorisation ${fuel}, ${gearbox}.`,
    `${input.mileage.toLocaleString("fr-FR")} km au compteur, véhicule ${condition}.`,
  ];

  const traits: string[] = [];
  if (input.firstHand) traits.push("première main");
  if (input.accidented === false) traits.push("jamais accidenté");
  if (input.powerHp) traits.push(`${input.powerHp} ch`);
  if (input.color) traits.push(`couleur ${input.color}`);
  if (traits.length > 0) sentences.push(`${traits.join(", ")}.`);

  sentences.push("Contactez le vendeur pour plus de détails ou pour convenir d'une visite.");

  return { title, description: sentences.join(" ") };
}

async function callAnthropic(
  input: ListingSuggestionInput
): Promise<{ title: string; description: string } | null> {
  const text = await callAnthropicMessages({
    maxTokens: 500,
    system:
      'Tu rédiges des annonces de vente de véhicules d\'occasion en Algérie pour la plateforme Souq Auto. Réponds UNIQUEMENT avec un objet JSON de la forme {"title": string, "description": string}, sans aucun texte avant ou après. N\'invente JAMAIS une caractéristique qui ne t\'a pas été fournie explicitement dans les données du véhicule. Le titre fait au maximum 120 caractères. La description fait entre 30 et 500 caractères, en français, dans un ton clair et factuel, sans superlatifs exagérés ni promesses non vérifiables.',
    messages: [{ role: "user", content: JSON.stringify(input) }],
  });
  if (!text) return null;

  const parsed = JSON.parse(text) as { title?: unknown; description?: unknown };
  if (typeof parsed.title !== "string" || typeof parsed.description !== "string") return null;

  return { title: parsed.title.slice(0, 120), description: parsed.description.slice(0, 5000) };
}

// Lot 249 — améliore un titre et une description déjà saisis par le vendeur :
// corrige les fautes, améliore la clarté et la structure, n'invente rien.
export type ImproveInput = {
  title: string;
  description: string;
  brand?: string;
  model?: string;
  year?: number;
  mileage?: number;
  condition?: string;
};

export async function improveListingText(
  input: ImproveInput
): Promise<{ title: string; description: string } | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const context = [
    input.brand && input.model ? `${input.brand} ${input.model}` : input.brand,
    input.year ? `${input.year}` : null,
    input.mileage != null ? `${input.mileage.toLocaleString("fr-DZ")} km` : null,
    input.condition === "NEUF" ? "neuf" : input.condition === "OCCASION" ? "occasion" : null,
  ]
    .filter(Boolean)
    .join(", ");

  const text = await callAnthropicMessages({
    maxTokens: 600,
    system:
      'Tu améliores des annonces de vente de véhicules pour la plateforme Souq Auto (Algérie). ' +
      'Corrige les fautes, améliore la clarté, la fluidité et la structure, sans jamais inventer de ' +
      'caractéristiques absentes du texte original. Réponds UNIQUEMENT avec un objet JSON : ' +
      '{"title": string (max 120 car.), "description": string (30-500 car.)}, aucun autre texte.',
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          context,
          title: input.title,
          description: input.description,
        }),
      },
    ],
  });
  if (!text) return null;

  try {
    const parsed = JSON.parse(text) as { title?: unknown; description?: unknown };
    if (typeof parsed.title !== "string" || typeof parsed.description !== "string") return null;
    return {
      title: parsed.title.slice(0, 120),
      description: parsed.description.slice(0, 5000),
    };
  } catch {
    return null;
  }
}

export async function generateListingSuggestion(
  input: ListingSuggestionInput
): Promise<{ title: string; description: string; source: "ai" | "heuristic" }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ...generateHeuristicSuggestion(input), source: "heuristic" };
  }

  try {
    const ai = await callAnthropic(input);
    if (ai) return { ...ai, source: "ai" };
  } catch (err) {
    console.error(`[AI listing] échec de la génération, repli heuristique: ${(err as Error).message}`);
  }

  return { ...generateHeuristicSuggestion(input), source: "heuristic" };
}
