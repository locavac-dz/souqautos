import { callAnthropicMessages } from "@/lib/anthropic-client";
import { prisma } from "@/lib/prisma";
import { estimatePrice } from "@/lib/price-estimation";

export type PriceAiEstimate = { low: number; high: number };

export async function estimatePriceWithAi(params: {
  brandId: number;
  modelId: number;
  year?: number;
  mileage?: number;
  condition?: string;
  fuelType?: string;
}): Promise<PriceAiEstimate | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const [brand, model] = await Promise.all([
    prisma.brand.findUnique({ where: { id: params.brandId }, select: { name: true } }),
    prisma.model.findUnique({ where: { id: params.modelId }, select: { name: true } }),
  ]);
  if (!brand || !model) return null;

  const parts = [
    `${brand.name} ${model.name}`,
    params.year ? `année ${params.year}` : null,
    params.mileage != null ? `${params.mileage.toLocaleString("fr-DZ")} km` : null,
    params.condition === "NEUF" ? "neuf" : params.condition === "OCCASION" ? "occasion" : null,
    params.fuelType ? `carburant ${params.fuelType}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  const year = new Date().getFullYear();
  const text = await callAnthropicMessages({
    system:
      "Tu es un expert du marché automobile algérien. Tu connais les prix courants des véhicules neufs et d'occasion en Algérie en dinars algériens (DA). Réponds UNIQUEMENT avec un objet JSON valide, aucun autre texte.",
    messages: [
      {
        role: "user",
        content: `Donne une fourchette de prix réaliste pour ce véhicule vendu en Algérie en ${year} : ${parts}.\n\nRéponds UNIQUEMENT avec : {"low":<entier en DA>,"high":<entier en DA>}`,
      },
    ],
    maxTokens: 80,
  });

  if (!text) return null;

  try {
    const match = text.match(/\{[^}]+\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as Record<string, unknown>).low !== "number" ||
      typeof (parsed as Record<string, unknown>).high !== "number"
    )
      return null;
    const low = Math.round((parsed as { low: number; high: number }).low);
    const high = Math.round((parsed as { low: number; high: number }).high);
    if (low <= 0 || high <= low) return null;
    return { low, high };
  } catch {
    return null;
  }
}

// Appelé dans after() après la création d'une annonce. N'appelle Claude que si les
// comparables DB sont insuffisants (< 3) — évite un appel inutile quand le marché
// est déjà bien documenté en base.
export async function computeAndStorePriceAiEstimate(
  listingId: string,
  params: {
    brandId: number | null;
    modelId: number | null;
    year: number;
    mileage: number | null;
    condition: string;
    fuelType: string | null;
  }
): Promise<void> {
  if (!params.brandId || !params.modelId) return;

  const market = await estimatePrice({
    brandId: params.brandId,
    modelId: params.modelId,
    year: params.year,
    mileage: params.mileage ?? undefined,
  });

  if (market && market.sampleSize >= 3) return;

  const ai = await estimatePriceWithAi({
    brandId: params.brandId,
    modelId: params.modelId,
    year: params.year,
    mileage: params.mileage ?? undefined,
    condition: params.condition,
    fuelType: params.fuelType ?? undefined,
  });
  if (!ai) return;

  await prisma.listing.update({
    where: { id: listingId },
    data: { priceAiLow: ai.low, priceAiHigh: ai.high, priceAiAt: new Date() },
  });
}
