import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/anthropic-client", () => ({
  callAnthropicMessages: vi.fn(),
}));

import { callAnthropicMessages } from "@/lib/anthropic-client";
import { generateMagArticleDraft, generateBuyingGuideDraft } from "@/lib/editorial-ai-writer";

const mockedCall = vi.mocked(callAnthropicMessages);

const VALID_ARTICLE_JSON = JSON.stringify({
  titleFr: "Entretien automobile en été en Algérie",
  titleAr: "صيانة السيارات في الصيف بالجزائر",
  excerptFr: "Conseils pratiques pour préparer sa voiture aux grandes chaleurs estivales.",
  excerptAr: "نصائح عملية لتحضير سيارتك لحرارة الصيف الشديدة.",
  contentFr: "a".repeat(200),
  contentAr: "ب".repeat(200),
});

const VALID_GUIDE_JSON = JSON.stringify({
  titleFr: "Guide d'achat Dacia Sandero en Algérie",
  titleAr: "دليل شراء داسيا سانديرو في الجزائر",
  excerptFr: "Tout savoir avant d'acheter une Dacia Sandero d'occasion.",
  excerptAr: "كل ما تحتاج معرفته قبل شراء داسيا سانديرو مستعملة.",
  contentFr: "c".repeat(200),
  contentAr: "د".repeat(200),
  guide: {
    checklistFr: "Vérifier la boîte\nVérifier le moteur",
    checklistAr: "تحقق من علبة التروس\nتحقق من المحرك",
    adviceFr: "La Sandero est un bon choix pour un premier véhicule.",
    adviceAr: "سانديرو خيار جيد كسيارة أولى في الجزائر.",
  },
});

describe("generateMagArticleDraft", () => {
  const topic = { key: "entretien-saison", promptFr: "Rédige un article sur l'entretien saisonnier." };

  it("parses a valid JSON response", async () => {
    mockedCall.mockResolvedValueOnce(VALID_ARTICLE_JSON);
    const result = await generateMagArticleDraft(topic);
    expect(result).not.toBeNull();
    expect(result!.titleFr).toBe("Entretien automobile en été en Algérie");
    expect(result!.titleAr).toBe("صيانة السيارات في الصيف بالجزائر");
  });

  it("strips markdown code fences around JSON", async () => {
    mockedCall.mockResolvedValueOnce("```json\n" + VALID_ARTICLE_JSON + "\n```");
    const result = await generateMagArticleDraft(topic);
    expect(result).not.toBeNull();
    expect(result!.titleFr).toContain("Entretien");
  });

  it("returns null when API returns null", async () => {
    mockedCall.mockResolvedValueOnce(null as unknown as string);
    const result = await generateMagArticleDraft(topic);
    expect(result).toBeNull();
  });

  it("returns null for invalid JSON", async () => {
    mockedCall.mockResolvedValueOnce("not json at all");
    const result = await generateMagArticleDraft(topic);
    expect(result).toBeNull();
  });

  it("returns null when title is too short", async () => {
    const bad = JSON.stringify({
      titleFr: "Court",
      titleAr: "قصير",
      excerptFr: "Résumé suffisamment long ici",
      excerptAr: "ملخص طويل بما فيه الكفاية هنا.",
      contentFr: "a".repeat(200),
      contentAr: "ب".repeat(200),
    });
    mockedCall.mockResolvedValueOnce(bad);
    const result = await generateMagArticleDraft(topic);
    expect(result).toBeNull();
  });

  it("truncates overly long titles", async () => {
    const long = JSON.stringify({
      titleFr: "T".repeat(200),
      titleAr: "ع".repeat(200),
      excerptFr: "Résumé suffisamment long ici!!",
      excerptAr: "ملخص طويل بما فيه الكفاية هنا!!!",
      contentFr: "a".repeat(200),
      contentAr: "ب".repeat(200),
    });
    mockedCall.mockResolvedValueOnce(long);
    const result = await generateMagArticleDraft(topic);
    expect(result).not.toBeNull();
    expect(result!.titleFr.length).toBe(150);
  });
});

describe("generateBuyingGuideDraft", () => {
  const ctx = { brandName: "Dacia", modelName: "Sandero", listingCount: 42, avgPrice: 2500000 };

  it("parses a valid guide JSON response", async () => {
    mockedCall.mockResolvedValueOnce(VALID_GUIDE_JSON);
    const result = await generateBuyingGuideDraft(ctx);
    expect(result).not.toBeNull();
    expect(result!.guide.checklistFr).toContain("Vérifier");
    expect(result!.guide.adviceAr).toContain("سانديرو");
  });

  it("returns null when guide sub-object is missing", async () => {
    mockedCall.mockResolvedValueOnce(VALID_ARTICLE_JSON);
    const result = await generateBuyingGuideDraft(ctx);
    expect(result).toBeNull();
  });

  it("returns null when advice is too short", async () => {
    const bad = JSON.stringify({
      titleFr: "Guide d'achat Dacia Sandero en Algérie",
      titleAr: "دليل شراء داسيا سانديرو في الجزائر",
      excerptFr: "Tout savoir avant d'acheter.",
      excerptAr: "كل ما تحتاج معرفته قبل الشراء.",
      contentFr: "c".repeat(200),
      contentAr: "د".repeat(200),
      guide: { checklistFr: "Ok", checklistAr: "حسنا", adviceFr: "Court", adviceAr: "قصير" },
    });
    mockedCall.mockResolvedValueOnce(bad);
    const result = await generateBuyingGuideDraft(ctx);
    expect(result).toBeNull();
  });
});
