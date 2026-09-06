import { z } from "zod";

// Lot 76 — les deux langues sont toujours requises : jamais un article à
// moitié traduit visible publiquement (même discipline que le reste du site
// bilingue FR/AR).
export const blogArticleSchema = z.object({
  titleFr: z.string().trim().min(10).max(150),
  titleAr: z.string().trim().min(10).max(150),
  excerptFr: z.string().trim().min(20).max(300),
  excerptAr: z.string().trim().min(20).max(300),
  contentFr: z.string().trim().min(100).max(20_000),
  contentAr: z.string().trim().min(100).max(20_000),
  published: z.boolean().default(false),
});

export type BlogArticleInput = z.infer<typeof blogArticleSchema>;
