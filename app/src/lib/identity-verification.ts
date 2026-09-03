import type { IdentityVerificationStatus } from "@prisma/client";

export type IdentitySubmissionCheck =
  | { ok: true }
  | { ok: false; error: "already_verified" | "request_pending" };

// Une demande refusée ne bloque pas une nouvelle soumission — seule une
// demande EN_ATTENTE (déjà en cours de revue) ou une identité déjà vérifiée
// empêche une nouvelle demande.
export function checkCanSubmitIdentityRequest({
  alreadyVerified,
  hasPendingRequest,
}: {
  alreadyVerified: boolean;
  hasPendingRequest: boolean;
}): IdentitySubmissionCheck {
  if (alreadyVerified) return { ok: false, error: "already_verified" };
  if (hasPendingRequest) return { ok: false, error: "request_pending" };
  return { ok: true };
}

export type IdentityReviewAction = "approve" | "reject";

export type IdentityReviewTransition =
  | { ok: true; newStatus: "APPROUVEE" | "REFUSEE" }
  | { ok: false; error: "invalid_transition" | "reason_required" };

// Un refus exige toujours une note (visible par le demandeur pour qu'il sache
// quoi corriger avant de soumettre à nouveau) ; une approbation n'en a pas
// besoin. Même logique que la modération d'annonces (Lot 7).
export function computeIdentityReviewTransition(
  currentStatus: IdentityVerificationStatus,
  action: IdentityReviewAction,
  reason?: string
): IdentityReviewTransition {
  if (currentStatus !== "EN_ATTENTE") {
    return { ok: false, error: "invalid_transition" };
  }
  if (action === "reject" && !reason?.trim()) {
    return { ok: false, error: "reason_required" };
  }
  return { ok: true, newStatus: action === "approve" ? "APPROUVEE" : "REFUSEE" };
}
