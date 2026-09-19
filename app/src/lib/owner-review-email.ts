import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { sendEmail, escapeHtml } from "@/lib/mailer";
import { SITE_URL } from "@/lib/site";

// Lot 116 — informe l'auteur d'un avis de propriétaire de la décision de
// l'équipe (avis publié, refusé, ou retiré après un signalement confirmé).
// Jamais bloquant : un email qui échoue ne défait pas la décision de modération.
export type OwnerReviewDecision = "approved" | "rejected" | "removed";

export async function sendOwnerReviewDecisionEmail(reviewId: string, decision: OwnerReviewDecision) {
  const review = await prisma.ownerReview.findUnique({
    where: { id: reviewId },
    include: { user: true, model: { include: { brand: true } } },
  });
  if (!review || review.user.deletedAt) return;

  const t = await getTranslations({ locale: review.user.locale, namespace: "Notifications" });
  const vehicle = escapeHtml(`${review.model.brand.name} ${review.model.name}`);
  const reason = escapeHtml(review.rejectionReason ?? "");
  const link = `${SITE_URL}/${review.user.locale}/voitures/${review.model.brand.slug}/${review.model.slug}`;

  const subject =
    decision === "approved"
      ? t("ownerReviewApprovedSubject")
      : decision === "rejected"
        ? t("ownerReviewRejectedSubject")
        : t("ownerReviewRemovedSubject");
  const body =
    decision === "approved"
      ? t("ownerReviewApprovedBody", { vehicle })
      : decision === "rejected"
        ? t("ownerReviewRejectedBody", { vehicle, reason })
        : t("ownerReviewRemovedBody", { vehicle, reason });

  const result = await sendEmail({
    to: review.user.email,
    subject,
    html: `<p>${t("greeting")}</p><p>${body}</p><p><a href="${link}">${t("ownerReviewLink")}</a></p>`,
  }).catch((err) => {
    console.error(`[EMAIL décision avis propriétaire] échec envoi: ${(err as Error).message}`);
    return null;
  });
  if (result?.previewUrl) {
    console.log(`[EMAIL décision avis propriétaire] ${result.previewUrl}`);
  }
}
