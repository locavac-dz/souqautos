import { z } from "zod";
import { INT4_MAX } from "./int-bounds";
import { normalizeSourceUrl } from "@/lib/press-review";

// Lot 114 — une entrée de la revue de presse. Les deux notes (français et arabe)
// sont écrites par la rédaction, dans ses propres mots : elles ne sont pas un
// extrait de l'article cité, et sont limitées en longueur pour ne pas pouvoir
// servir à en recopier un passage.
export const pressReviewSchema = z
  .object({
    sourceName: z.string().trim().min(2).max(80),
    url: z
      .string()
      .transform((value, ctx) => {
        const normalized = normalizeSourceUrl(value);
        if (!normalized) {
          ctx.addIssue({ code: "custom", message: "Adresse https:// d'un article, sans identifiant ni adresse IP." });
          return z.NEVER;
        }
        return normalized;
      }),
    title: z.string().trim().min(5).max(200),
    sourcePublishedAt: z.iso.date().optional(),
    noteFr: z.string().trim().min(20).max(300),
    noteAr: z.string().trim().min(20).max(300),
    brandId: z.number().int().positive().max(INT4_MAX).optional(),
    modelId: z.number().int().positive().max(INT4_MAX).optional(),
    published: z.boolean().default(false),
  })
  .superRefine((value, ctx) => {
    // Une date de parution dans le futur chez le média serait forcément fausse.
    if (value.sourcePublishedAt && new Date(`${value.sourcePublishedAt}T00:00:00Z`).getTime() > Date.now() + 86_400_000) {
      ctx.addIssue({ code: "custom", path: ["sourcePublishedAt"], message: "La date de parution ne peut pas être dans le futur." });
    }
  });

export type PressReviewInput = z.infer<typeof pressReviewSchema>;
