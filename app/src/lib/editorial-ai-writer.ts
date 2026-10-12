import { callAnthropicMessages } from "@/lib/anthropic-client";
import type { MagTopicTemplate } from "@/lib/editorial-topics";

type GeneratedArticle = {
  titleFr: string;
  titleAr: string;
  excerptFr: string;
  excerptAr: string;
  contentFr: string;
  contentAr: string;
};

type GeneratedGuide = GeneratedArticle & {
  guide: {
    checklistFr: string;
    checklistAr: string;
    adviceFr: string;
    adviceAr: string;
  };
};

const SYSTEM_PROMPT = `Tu es le rédacteur en chef de souqautos.com, le premier site d'annonces automobiles en Algérie.
Tu rédiges du contenu éditorial bilingue (français et arabe algérien) destiné à des acheteurs et propriétaires de voitures en Algérie.

Règles :
- Ton professionnel mais accessible, pas de jargon inutile
- Contenu factuel et utile, pas de remplissage
- Contexte 100 % algérien : réglementation, marques populaires, conditions routières, climat
- Le contenu en arabe doit être de l'arabe standard moderne (pas du dialecte), naturel et idiomatique
- Format Markdown pour le corps de l'article (titres ##, listes, gras)
- Réponds UNIQUEMENT en JSON valide, sans commentaire ni texte autour`;

export async function generateMagArticleDraft(topic: MagTopicTemplate): Promise<GeneratedArticle | null> {
  const prompt = `${topic.promptFr}

Réponds en JSON avec exactement ces clés :
{
  "titleFr": "titre en français (10-150 caractères)",
  "titleAr": "titre en arabe (10-150 caractères)",
  "excerptFr": "résumé en français (20-300 caractères)",
  "excerptAr": "résumé en arabe (20-300 caractères)",
  "contentFr": "article complet en français, format Markdown (500-3000 mots)",
  "contentAr": "article complet en arabe, format Markdown (500-3000 mots)"
}`;

  const raw = await callAnthropicMessages({
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
    maxTokens: 8192,
    timeoutMs: 120_000,
  });

  return parseArticleJson(raw);
}

export async function generateBuyingGuideDraft(context: {
  brandName: string;
  modelName: string;
  listingCount: number;
  avgPrice?: number;
}): Promise<GeneratedGuide | null> {
  const priceHint = context.avgPrice ? ` Le prix moyen constaté sur souqautos.com est d'environ ${context.avgPrice.toLocaleString("fr-DZ")} DA.` : "";
  const prompt = `Rédige un guide d'achat complet pour la ${context.brandName} ${context.modelName} en Algérie.
${context.listingCount} annonces sont actuellement publiées sur souqautos.com pour ce modèle.${priceHint}

Le guide doit couvrir : les versions/motorisations disponibles en Algérie, les points forts et faibles connus, les pannes courantes, le coût d'entretien estimé, la disponibilité des pièces détachées, et un conseil d'achat.

Réponds en JSON avec exactement ces clés :
{
  "titleFr": "titre en français (10-150 caractères)",
  "titleAr": "titre en arabe (10-150 caractères)",
  "excerptFr": "résumé en français (20-300 caractères)",
  "excerptAr": "résumé en arabe (20-300 caractères)",
  "contentFr": "guide complet en français, format Markdown (500-3000 mots)",
  "contentAr": "guide complet en arabe, format Markdown (500-3000 mots)",
  "guide": {
    "checklistFr": "liste de vérification, un point par ligne (5-10 points en français)",
    "checklistAr": "نفس القائمة بالعربية (5-10 نقاط)",
    "adviceFr": "conseil d'achat synthétique en français (20-400 caractères)",
    "adviceAr": "نصيحة شراء بالعربية (20-400 حرف)"
  }
}`;

  const raw = await callAnthropicMessages({
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
    maxTokens: 8192,
    timeoutMs: 120_000,
  });

  return parseGuideJson(raw);
}

function parseArticleJson(raw: string | null): GeneratedArticle | null {
  if (!raw) return null;
  try {
    const cleaned = raw.replace(/^```json\s*\n?/, "").replace(/\n?```\s*$/, "");
    const data = JSON.parse(cleaned);
    if (
      typeof data.titleFr === "string" && data.titleFr.length >= 10 &&
      typeof data.titleAr === "string" && data.titleAr.length >= 10 &&
      typeof data.excerptFr === "string" && data.excerptFr.length >= 20 &&
      typeof data.excerptAr === "string" && data.excerptAr.length >= 20 &&
      typeof data.contentFr === "string" && data.contentFr.length >= 100 &&
      typeof data.contentAr === "string" && data.contentAr.length >= 100
    ) {
      return {
        titleFr: data.titleFr.slice(0, 150),
        titleAr: data.titleAr.slice(0, 150),
        excerptFr: data.excerptFr.slice(0, 300),
        excerptAr: data.excerptAr.slice(0, 300),
        contentFr: data.contentFr.slice(0, 20_000),
        contentAr: data.contentAr.slice(0, 20_000),
      };
    }
  } catch { /* invalid JSON */ }
  return null;
}

function parseGuideJson(raw: string | null): GeneratedGuide | null {
  const article = parseArticleJson(raw);
  if (!article || !raw) return null;
  try {
    const cleaned = raw.replace(/^```json\s*\n?/, "").replace(/\n?```\s*$/, "");
    const data = JSON.parse(cleaned);
    const g = data.guide;
    if (
      g &&
      typeof g.checklistFr === "string" && g.checklistFr.trim().length > 0 &&
      typeof g.checklistAr === "string" && g.checklistAr.trim().length > 0 &&
      typeof g.adviceFr === "string" && g.adviceFr.length >= 20 &&
      typeof g.adviceAr === "string" && g.adviceAr.length >= 20
    ) {
      return {
        ...article,
        guide: {
          checklistFr: g.checklistFr.slice(0, 2000),
          checklistAr: g.checklistAr.slice(0, 2000),
          adviceFr: g.adviceFr.slice(0, 400),
          adviceAr: g.adviceAr.slice(0, 400),
        },
      };
    }
  } catch { /* invalid JSON */ }
  return null;
}
