// Lot 85 — comparaison assistée (§ cahier d'architecture, phase V3 « AI
// Compare ») : le comparateur manuel (jusqu'à 4 véhicules) existe depuis le
// Lot 5, mais aucune synthèse n'aidait à trancher entre les annonces
// comparées. Même patron que l'Assistant IA de rédaction (Lot 57) et la
// recherche en langage naturel (Lot 58) : les faits saillants (le moins
// cher, le moins kilométré...) sont TOUJOURS calculés par une fonction pure
// déterministe, jamais devinés par un modèle — seule la mise en mots (le
// paragraphe de synthèse) vient réellement de l'IA quand une clé Anthropic
// est configurée, avec un repli honnête sinon (pas de paragraphe, seulement
// les faits saillants structurés, affichés via les traductions existantes).

import { callAnthropicMessages } from "./anthropic-client";

export type ComparableListingFacts = {
  id: string;
  price: number;
  mileage: number | null;
  year: number;
  powerHp: number | null;
  trustScore: number | null;
};

export type CompareHighlights = {
  cheapestId: string | null;
  lowestMileageId: string | null;
  newestId: string | null;
  // null si au moins une annonce comparée n'a pas cette donnée — jamais un
  // classement partiel qui ignorerait silencieusement une annonce.
  mostPowerfulId: string | null;
  mostTrustedId: string | null;
};

function pickExtreme<T>(
  listings: T[],
  getValue: (l: T) => number | null,
  mode: "min" | "max",
  getId: (l: T) => string
): string | null {
  if (listings.some((l) => getValue(l) === null)) return null;
  let best: T | null = null;
  let bestValue = mode === "min" ? Infinity : -Infinity;
  for (const listing of listings) {
    const value = getValue(listing)!;
    if ((mode === "min" && value < bestValue) || (mode === "max" && value > bestValue)) {
      best = listing;
      bestValue = value;
    }
  }
  return best ? getId(best) : null;
}

export function computeCompareHighlights(listings: ComparableListingFacts[]): CompareHighlights {
  if (listings.length < 2) {
    return { cheapestId: null, lowestMileageId: null, newestId: null, mostPowerfulId: null, mostTrustedId: null };
  }
  return {
    cheapestId: pickExtreme(listings, (l) => l.price, "min", (l) => l.id),
    lowestMileageId: pickExtreme(listings, (l) => l.mileage, "min", (l) => l.id),
    newestId: pickExtreme(listings, (l) => l.year, "max", (l) => l.id),
    mostPowerfulId: pickExtreme(listings, (l) => l.powerHp, "max", (l) => l.id),
    mostTrustedId: pickExtreme(listings, (l) => l.trustScore, "max", (l) => l.id),
  };
}

type NarrativeListing = ComparableListingFacts & { title: string };

async function callAnthropicForNarrative(listings: NarrativeListing[], locale: string): Promise<string | null> {
  const text = await callAnthropicMessages({
    maxTokens: 400,
    system: `Tu résumes une comparaison entre véhicules d'occasion pour la plateforme Souq Autos (Algérie). Réponds UNIQUEMENT avec un paragraphe de 2 à 4 phrases en ${locale === "ar" ? "arabe" : "français"}, factuel et neutre, sans superlatifs marketing. N'invente JAMAIS une caractéristique absente des données fournies. Ne donne pas de conseil d'achat définitif, seulement une synthèse des différences.`,
    messages: [{ role: "user", content: JSON.stringify(listings) }],
  });
  return text ? text.trim().slice(0, 1000) : null;
}

export type CompareSummary = {
  highlights: CompareHighlights;
  narrative: string | null;
  source: "ai" | "heuristic";
};

export async function generateCompareSummary(
  listings: NarrativeListing[],
  locale: string
): Promise<CompareSummary> {
  const highlights = computeCompareHighlights(listings);

  if (!process.env.ANTHROPIC_API_KEY) {
    return { highlights, narrative: null, source: "heuristic" };
  }

  try {
    const narrative = await callAnthropicForNarrative(listings, locale);
    if (narrative) return { highlights, narrative, source: "ai" };
  } catch (err) {
    console.error(`[AI compare] échec de la synthèse, repli heuristique: ${(err as Error).message}`);
  }

  return { highlights, narrative: null, source: "heuristic" };
}
