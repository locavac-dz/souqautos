import { z } from "zod";
import { COMMENT_MAX, COMMENT_MIN, MILEAGE_MAX_KM, OWNER_REVIEW_REPORT_REASONS, PURCHASE_YEAR_MIN, containsContactInfo } from "@/lib/owner-review";

// Lot 116 — avis d'un propriétaire. La note est un entier de 1 à 5 ; le texte est
// obligatoire (un avis sans texte n'apprend rien) et ne peut pas contenir de
// coordonnées ni de lien. Année d'achat et kilométrage, facultatifs, situent
// l'avis (« 3 ans, 45 000 km ») sans rien prouver.
export const ownerReviewSchema = z
  .object({
    rating: z.number().int().min(1).max(5),
    comment: z.string().trim().min(COMMENT_MIN).max(COMMENT_MAX),
    purchaseYear: z.number().int().min(PURCHASE_YEAR_MIN).optional(),
    mileageKm: z.number().int().min(0).max(MILEAGE_MAX_KM).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.purchaseYear && value.purchaseYear > new Date().getFullYear()) {
      ctx.addIssue({ code: "custom", path: ["purchaseYear"], message: "L'année d'achat ne peut pas être dans le futur." });
    }
    if (containsContactInfo(value.comment)) {
      ctx.addIssue({ code: "custom", path: ["comment"], message: "Ni numéro de téléphone, ni email, ni lien dans un avis." });
    }
  });

export type OwnerReviewInput = z.infer<typeof ownerReviewSchema>;

export const ownerReviewReportSchema = z
  .object({
    reason: z.enum(OWNER_REVIEW_REPORT_REASONS as [string, ...string[]]),
    comment: z.string().trim().max(500).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.reason === "AUTRE" && !value.comment) {
      ctx.addIssue({ code: "custom", path: ["comment"], message: "Précisez le motif." });
    }
  });

export const ownerReviewModerationSchema = z.object({
  action: z.enum(["approve", "reject"]),
  reason: z.string().max(600).optional(),
});
