import { z } from "zod";
import { INT4_MAX } from "./int-bounds";
import { isValidBulletList, isValidRating } from "@/lib/road-test";
import { MAX_CHECKLIST_ITEMS, isValidChecklist } from "@/lib/buying-guide";

export const articleKinds = ["ARTICLE", "ESSAI", "GUIDE"] as const;

// Lot 110 — un essai auto est un article enrichi : note, points forts/faibles,
// verdict, et lien facultatif vers la marque/le modèle du catalogue.
const bulletList = z
  .string()
  .trim()
  .refine(isValidBulletList, { message: "1 à 8 lignes de 200 caractères maximum" });

export const roadTestSchema = z.object({
  brandId: z.number().int().positive().max(INT4_MAX).optional(),
  modelId: z.number().int().positive().max(INT4_MAX).optional(),
  generationId: z.number().int().positive().max(INT4_MAX).optional(),
  rating: z.number().refine(isValidRating, { message: "0,5 à 5 par demi-point" }),
  prosFr: bulletList,
  prosAr: bulletList,
  consFr: bulletList,
  consAr: bulletList,
  verdictFr: z.string().trim().min(20).max(400),
  verdictAr: z.string().trim().min(20).max(400),
  testedVersion: z.string().trim().max(120).optional(),
  testedAt: z.iso.date().optional(),
});

export type RoadTestInput = z.infer<typeof roadTestSchema>;

// Lot 126 — un guide d'achat est un article de fond rattaché à UN MODÈLE du catalogue (obligatoire :
// c'est ce qui le relie à la page du modèle et aux annonces de ce modèle). Aucune marque envoyée : elle
// se déduit du modèle côté serveur. La génération est facultative. Une liste « à vérifier avant
// d'acheter » (1 à 12 lignes) et « notre conseil », dans les deux langues.
const checklist = z
  .string()
  .trim()
  .refine(isValidChecklist, { message: `1 à ${MAX_CHECKLIST_ITEMS} lignes de 200 caractères maximum` });

export const guideSchema = z.object({
  modelId: z.number().int().positive().max(INT4_MAX),
  generationId: z.number().int().positive().max(INT4_MAX).optional(),
  checklistFr: checklist,
  checklistAr: checklist,
  adviceFr: z.string().trim().min(20).max(400),
  adviceAr: z.string().trim().min(20).max(400),
});

export type GuideInput = z.infer<typeof guideSchema>;

// Lot 76 — les deux langues sont toujours requises : jamais un article à
// moitié traduit visible publiquement (même discipline que le reste du site
// bilingue FR/AR).
//
// Lot 110 — `publication` remplace l'ancien booléen `published` : brouillon,
// publier maintenant, ou programmer à une date. La date effective est décidée
// côté serveur (cf. resolvePublishedAt).
export const blogArticleSchema = z
  .object({
    kind: z.enum(articleKinds).default("ARTICLE"),
    titleFr: z.string().trim().min(10).max(150),
    titleAr: z.string().trim().min(10).max(150),
    excerptFr: z.string().trim().min(20).max(300),
    excerptAr: z.string().trim().min(20).max(300),
    contentFr: z.string().trim().min(100).max(20_000),
    contentAr: z.string().trim().min(100).max(20_000),
    publication: z
      .discriminatedUnion("mode", [
        z.object({ mode: z.literal("draft") }),
        z.object({ mode: z.literal("now") }),
        z.object({ mode: z.literal("scheduled"), at: z.iso.datetime() }),
      ])
      .default({ mode: "draft" }),
    roadTest: roadTestSchema.optional(),
    guide: guideSchema.optional(),
    // Lot 111 — adresse d'une image déjà envoyée par /api/admin/blog/cover ; son
    // appartenance à notre stockage est vérifiée par les routes (isBlogCoverUrl,
    // qui dépend de la configuration S3). `null` = pas de couverture.
    coverImageUrl: z.string().trim().max(500).nullish(),
    // Lot 115 — source d'un article du magazine (cf. src/lib/blog-source.ts,
    // qui la valide et normalise l'adresse).
    sourceName: z.string().max(200).nullish(),
    sourceUrl: z.string().max(600).nullish(),
  })
  .superRefine((value, ctx) => {
    if ((value.sourceName?.trim() || value.sourceUrl?.trim()) && value.kind !== "ARTICLE") {
      ctx.addIssue({ code: "custom", path: ["sourceName"], message: "Un essai ou un guide est rédigé par la rédaction : pas de source externe." });
    }
    if (value.coverImageUrl && value.kind === "ARTICLE") {
      ctx.addIssue({ code: "custom", path: ["coverImageUrl"], message: "Seul un essai ou un guide porte une photo de couverture." });
    }
    if (value.kind === "ESSAI" && !value.roadTest) {
      ctx.addIssue({ code: "custom", path: ["roadTest"], message: "Un essai exige sa fiche (note, points forts/faibles, verdict)." });
    }
    if (value.kind !== "ESSAI" && value.roadTest) {
      ctx.addIssue({ code: "custom", path: ["roadTest"], message: "Seul un essai porte une fiche d'essai." });
    }
    if (value.kind === "GUIDE" && !value.guide) {
      ctx.addIssue({ code: "custom", path: ["guide"], message: "Un guide d'achat exige son modèle, sa liste à vérifier et son conseil." });
    }
    if (value.kind !== "GUIDE" && value.guide) {
      ctx.addIssue({ code: "custom", path: ["guide"], message: "Seul un guide d'achat porte une fiche de guide." });
    }
  });

export type BlogArticleInput = z.infer<typeof blogArticleSchema>;
