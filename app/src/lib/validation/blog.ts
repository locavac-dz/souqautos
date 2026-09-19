import { z } from "zod";
import { INT4_MAX } from "./int-bounds";
import { isValidBulletList, isValidRating } from "@/lib/road-test";

export const articleKinds = ["ARTICLE", "ESSAI"] as const;

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
  })
  .superRefine((value, ctx) => {
    if (value.kind === "ESSAI" && !value.roadTest) {
      ctx.addIssue({ code: "custom", path: ["roadTest"], message: "Un essai exige sa fiche (note, points forts/faibles, verdict)." });
    }
    if (value.kind === "ARTICLE" && value.roadTest) {
      ctx.addIssue({ code: "custom", path: ["roadTest"], message: "Un article simple ne porte pas de fiche d'essai." });
    }
  });

export type BlogArticleInput = z.infer<typeof blogArticleSchema>;
