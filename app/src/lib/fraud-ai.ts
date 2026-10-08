import { callAnthropicMessages } from "./anthropic-client";
import { prisma } from "./prisma";

// Lot 246 — analyse Claude API du texte d'une annonce (V3, §16 « Règles + IA »).
// Complète les règles déterministes (hash, heuristiques) par une analyse
// sémantique : urgence suspecte, incohérences déclaratives, formules d'arnaque
// courantes sur le marché algérien. Repli silencieux si ANTHROPIC_API_KEY absent
// ou si l'appel échoue — jamais un faux signal inventé.

type ListingTextForAi = {
  title: string;
  description: string;
  price: number;
  condition: "NEUF" | "OCCASION";
  year: number;
  mileage: number | null;
};

// Retourne une phrase courte (<= 200 car.) si un signal est détecté, null sinon.
// Jamais une accusation — une aide à la lecture du modérateur humain.
export async function analyzeListingForFraud(listing: ListingTextForAi): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  try {
    const text = await callAnthropicMessages({
      maxTokens: 120,
      system:
        "Tu es un modérateur d'annonces automobile algériennes. Analyse cette annonce et détecte uniquement les signaux de fraude ÉVIDENTS et CONCRETS : urgence suspecte (\"vend vite\", \"besoin d'argent urgent\", \"prix à débattre d'urgence\"), promesses invraisemblables (\"jamais tombé en panne\", \"zéro défaut\" sur un véhicule d'occasion à fort kilométrage), incohérence entre état déclaré et données (km très élevé pour une condition NEUF), ou contact anormal (\"WhatsApp uniquement\", \"pas de visite possible\"). Si tu détectes un signal, réponds en UNE phrase française courte (< 100 caractères) décrivant précisément ce signal. Si rien de suspect, réponds exactement le mot null. N'invente jamais un signal absent.",
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            titre: listing.title,
            description: listing.description,
            prix_dzd: listing.price,
            état: listing.condition,
            année: listing.year,
            kilométrage: listing.mileage,
          }),
        },
      ],
    });

    if (!text || text.trim() === "null") return null;
    return text.trim().slice(0, 200);
  } catch (err) {
    console.error(`[fraud-ai] échec de l'analyse: ${(err as Error).message}`);
    return null;
  }
}

// Appelle analyzeListingForFraud et persiste le résultat (aiSuspicion +
// aiCheckedAt). Utilisé via after() à la soumission, comme refreshListingFraudScore.
export async function analyzeAndStoreListingFraud(
  listingId: string,
  listing: ListingTextForAi
): Promise<void> {
  const suspicion = await analyzeListingForFraud(listing);
  await prisma.listing.update({
    where: { id: listingId },
    data: {
      aiSuspicion: suspicion ?? null,
      aiCheckedAt: new Date(),
    },
  });
}
