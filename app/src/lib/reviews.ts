export type ReviewEligibility =
  | { ok: true }
  | { ok: false; error: "cannot_review_self" | "already_reviewed" | "no_interaction" };

// Un avis exige une vraie interaction préalable (conversation avec ce vendeur) —
// jamais un simple clic sans preuve d'échange, pour limiter les faux avis.
export function checkReviewEligibility({
  isSelf,
  hasInteracted,
  alreadyReviewed,
}: {
  isSelf: boolean;
  hasInteracted: boolean;
  alreadyReviewed: boolean;
}): ReviewEligibility {
  if (isSelf) return { ok: false, error: "cannot_review_self" };
  if (alreadyReviewed) return { ok: false, error: "already_reviewed" };
  if (!hasInteracted) return { ok: false, error: "no_interaction" };
  return { ok: true };
}

export function isValidRating(rating: number): boolean {
  return Number.isInteger(rating) && rating >= 1 && rating <= 5;
}

export function computeAverageRating(ratings: number[]): { average: number; count: number } {
  if (ratings.length === 0) {
    return { average: 0, count: 0 };
  }
  const sum = ratings.reduce((total, r) => total + r, 0);
  return { average: Math.round((sum / ratings.length) * 10) / 10, count: ratings.length };
}

// Comblement du plus vieux écart encore ouvert (Lot 10, répété au Lot 19) :
// jusqu'ici, aucune réponse du vendeur/de l'entreprise évaluée n'était possible.
export type ReviewReplyValidation =
  | { ok: true }
  | { ok: false; error: "reply_required" | "reply_too_long" };

export function validateReviewReply(reply: string): ReviewReplyValidation {
  const trimmed = reply.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: "reply_required" };
  }
  if (trimmed.length > 1000) {
    return { ok: false, error: "reply_too_long" };
  }
  return { ok: true };
}
