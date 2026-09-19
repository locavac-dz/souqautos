import type { OwnerReviewStatus, ReportReason } from "@prisma/client";
import { computeAverageRating } from "@/lib/reviews";

// Lot 116 — avis de propriétaires par modèle. Logique pure, testée sans base.

export const COMMENT_MIN = 40;
export const COMMENT_MAX = 2000;
export const REASON_MIN = 5;
export const REASON_MAX = 300;
export const PURCHASE_YEAR_MIN = 1990;
export const MILEAGE_MAX_KM = 1_000_000;

// La note moyenne n'est affichée qu'à partir de ce nombre d'avis publiés : avec
// un ou deux avis, une « moyenne » ne serait qu'un avis isolé présenté comme une
// statistique.
export const MIN_REVIEWS_FOR_AVERAGE = 3;

// Nombre d'avis publiés affichés sur la page d'un modèle.
export const REVIEWS_PER_MODEL_PAGE = 10;

// Motifs qu'un lecteur peut invoquer pour signaler un avis publié (parmi ceux
// qui existent déjà pour les signalements d'annonces).
export const OWNER_REVIEW_REPORT_REASONS: ReportReason[] = ["CONTENU_INAPPROPRIE", "FRAUDE_SUSPECTEE", "AUTRE"];

export type OwnerReviewEligibility =
  | { ok: true }
  | { ok: false; error: "email_not_verified" };

// Seul critère : l'adresse email a été vérifiée (Lot 11). Un compte suspendu ou
// supprimé n'atteint pas ces routes (`getCurrentUser` les écarte). Aucune preuve
// de possession n'est demandée : l'avis est présenté comme celui d'un
// propriétaire DÉCLARÉ, et validé par l'équipe avant publication.
export function checkCanWriteOwnerReview({ emailVerified }: { emailVerified: boolean }): OwnerReviewEligibility {
  return emailVerified ? { ok: true } : { ok: false, error: "email_not_verified" };
}

// Numéros (locaux ou +213), adresses email et liens : un avis n'est pas une
// annonce déguisée ni un moyen de renvoyer vers un vendeur ou un site. Détecté à
// l'envoi pour ne pas laisser la file de modération se remplir de démarchage ;
// la modération humaine reste l'arbitre final.
const EMAIL = /[^\s@]+@[^\s@]+\.[a-z]{2,}/i;
const URL_LIKE = /(https?:\/\/|www\.)|\b[a-z0-9-]+\.(com|net|org|fr|dz|info|biz|io|co|me|shop|store|site|online)\b/i;
const PHONE = /(?:\+?\s?213|\b0)[\s.\-]?[5-7](?:[\s.\-]?\d){8}\b/;

export function containsContactInfo(text: string): boolean {
  // Les chiffres arabo-indiens (٠-٩) sont ramenés à 0-9 avant le test.
  const normalized = text.replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660));
  return EMAIL.test(normalized) || URL_LIKE.test(normalized) || PHONE.test(normalized);
}

export type OwnerRatingSummary = {
  count: number;
  average: number;
  // `false` sous MIN_REVIEWS_FOR_AVERAGE : le nombre d'avis est montré, pas la moyenne.
  showAverage: boolean;
};

export function summarizeOwnerRatings(ratings: number[]): OwnerRatingSummary {
  const { average, count } = computeAverageRating(ratings);
  return { count, average, showAverage: count >= MIN_REVIEWS_FOR_AVERAGE };
}

export type ModerationAction = "approve" | "reject";

export type ModerationTransition =
  | { ok: true; newStatus: "PUBLIE" | "REFUSE" }
  | { ok: false; error: "invalid_transition" };

// Seul un avis EN_ATTENTE est validé ou refusé. Le retrait d'un avis déjà publié
// passe par un signalement confirmé (voir `removedAfterReportUpdate`), jamais par
// un second refus silencieux.
export function computeModerationTransition(
  current: OwnerReviewStatus,
  action: ModerationAction
): ModerationTransition {
  if (current !== "EN_ATTENTE") return { ok: false, error: "invalid_transition" };
  return { ok: true, newStatus: action === "approve" ? "PUBLIE" : "REFUSE" };
}

export type RejectionValidation = { ok: true; reason: string } | { ok: false; error: "reason_required" };

// Un refus s'explique à l'auteur : motif obligatoire, de 5 à 300 caractères.
export function validateRejectionReason(raw: string | undefined): RejectionValidation {
  const reason = raw?.trim() ?? "";
  if (reason.length < REASON_MIN || reason.length > REASON_MAX) return { ok: false, error: "reason_required" };
  return { ok: true, reason };
}

// Une modification par l'auteur remet TOUJOURS l'avis en attente : on ne publie
// pas un texte pour le remplacer ensuite par un autre sans relecture. Le motif
// d'un refus précédent et les dates de modération sont effacés.
export function editedByAuthorUpdate() {
  return {
    status: "EN_ATTENTE" as const,
    rejectionReason: null,
    moderatedAt: null,
    publishedAt: null,
  };
}

export const REMOVED_AFTER_REPORT_REASON = "Retiré après un signalement confirmé par l'équipe de modération.";

export function removedAfterReportUpdate(now: Date) {
  return {
    status: "REFUSE" as const,
    rejectionReason: REMOVED_AFTER_REPORT_REASON,
    moderatedAt: now,
    publishedAt: null,
  };
}

// Même synthèse à partir d'un agrégat de la base (moyenne et effectif), pour ne
// pas charger tous les avis d'un modèle juste pour en faire la moyenne.
export function summarizeOwnerAggregate(average: number | null, count: number): OwnerRatingSummary {
  const rounded = average === null ? 0 : Math.round(average * 10) / 10;
  return { count, average: rounded, showAverage: count >= MIN_REVIEWS_FOR_AVERAGE };
}
