// Lot 250 — recommandations inter-marques : même segment, autre marque.
// `getSimilarListings` (Lot 152) reste dans la même marque ; cette couche
// demande à Claude quels modèles concurrents un acheteur comparerait, puis
// requête la base pour les annonces correspondantes.

import { callAnthropicMessages } from "@/lib/anthropic-client";
import { prisma } from "@/lib/prisma";
import { cachedReference } from "@/lib/reference-data";
import { listingCardInclude, type ListingWithCardRelations } from "@/lib/search";

const ALT_MODELS_TTL_MS = 60 * 60 * 1000; // 1 heure — les concurrents d'un modèle changent rarement
const PRICE_BAND = 0.4; // ±40 % — plus large que similar-listings pour les alternatives inter-marques
const MAX_PER_MODEL = 2;
const MAX_TOTAL = 6;

type AltModel = { brand: string; model: string };

async function fetchSegmentAlternatives(brandName: string, modelName: string): Promise<AltModel[]> {
  if (!process.env.ANTHROPIC_API_KEY) return [];

  const text = await callAnthropicMessages({
    system:
      "Tu es un expert du marché automobile algérien. Réponds UNIQUEMENT avec un tableau JSON valide, aucun autre texte.",
    messages: [
      {
        role: "user",
        content:
          `Quels 3 à 5 modèles concurrents directs (d'autres marques) compare-t-on typiquement avec une ` +
          `${brandName} ${modelName} sur le marché algérien ?\n\n` +
          `Réponds UNIQUEMENT avec : [{"brand":"…","model":"…"},…]`,
      },
    ],
    maxTokens: 150,
  });
  if (!text) return [];

  try {
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const arr = JSON.parse(match[0]) as unknown[];
    return arr
      .filter(
        (x): x is AltModel =>
          typeof x === "object" &&
          x !== null &&
          typeof (x as Record<string, unknown>).brand === "string" &&
          typeof (x as Record<string, unknown>).model === "string"
      )
      .slice(0, 5);
  } catch {
    return [];
  }
}

// Retourne les annonces publiées pour les modèles alternatifs proposés par l'IA.
// Toujours 0 si ANTHROPIC_API_KEY est absent ou si Claude n'est pas disponible.
export async function getAlternativeListings({
  excludeId,
  brandId,
  modelId,
  price,
}: {
  excludeId: string;
  brandId: number | null;
  modelId: number | null;
  price: number;
}): Promise<ListingWithCardRelations[]> {
  if (!brandId || !modelId) return [];

  const [brand, model] = await Promise.all([
    prisma.brand.findUnique({ where: { id: brandId }, select: { name: true } }),
    prisma.model.findUnique({ where: { id: modelId }, select: { name: true } }),
  ]);
  if (!brand || !model) return [];

  const alts = await cachedReference(
    `segment-alts:${brandId}-${modelId}`,
    () => fetchSegmentAlternatives(brand.name, model.name),
    { ttlMs: ALT_MODELS_TTL_MS }
  );
  if (alts.length === 0) return [];

  const batches = await Promise.all(
    alts.map(async ({ brand: altBrand, model: altModel }) => {
      const brandRow = await prisma.brand.findFirst({
        where: { name: { contains: altBrand, mode: "insensitive" } },
        select: { id: true },
      });
      if (!brandRow) return [] as ListingWithCardRelations[];

      const modelRow = await prisma.model.findFirst({
        where: { brandId: brandRow.id, name: { contains: altModel, mode: "insensitive" } },
        select: { id: true },
      });
      if (!modelRow) return [] as ListingWithCardRelations[];

      return prisma.listing.findMany({
        where: {
          status: "PUBLIEE",
          brandId: brandRow.id,
          modelId: modelRow.id,
          id: { not: excludeId },
          price: {
            gte: Math.round(price * (1 - PRICE_BAND)),
            lte: Math.round(price * (1 + PRICE_BAND)),
          },
        },
        orderBy: { publishedAt: "desc" },
        take: MAX_PER_MODEL,
        include: listingCardInclude,
      });
    })
  );

  // Déduplique et plafonne à MAX_TOTAL
  const seen = new Set<string>([excludeId]);
  const listings: ListingWithCardRelations[] = [];
  for (const batch of batches) {
    for (const l of batch) {
      if (!seen.has(l.id) && listings.length < MAX_TOTAL) {
        seen.add(l.id);
        listings.push(l);
      }
    }
  }
  return listings;
}
