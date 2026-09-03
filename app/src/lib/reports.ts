import type { ReportReason, ReportStatus } from "@prisma/client";

// Motifs propres à un signalement d'annonce vs un signalement d'utilisateur —
// certains motifs n'ont de sens que pour l'un ou l'autre (ex : "véhicule
// potentiellement volé" pour une annonce, "messages abusifs" pour un profil).
export const LISTING_REPORT_REASONS: ReportReason[] = [
  "PRIX_SUSPECT",
  "FRAUDE_SUSPECTEE",
  "VEHICULE_VOLE",
  "DOUBLON",
  "CONTENU_INAPPROPRIE",
  "AUTRE",
];

export const USER_REPORT_REASONS: ReportReason[] = [
  "COMPORTEMENT_FRAUDULEUX",
  "MESSAGES_ABUSIFS",
  "USURPATION_IDENTITE",
  "AUTRE",
];

export type ReportSubmissionValidation =
  | { ok: true }
  | { ok: false; error: "comment_required" };

// AUTRE exige un commentaire (sinon rien d'exploitable pour la modération) ;
// les autres motifs sont suffisamment explicites seuls. Règle commune aux
// signalements d'annonce et d'utilisateur.
export function validateReportSubmission({
  reason,
  comment,
}: {
  reason: ReportReason;
  comment?: string;
}): ReportSubmissionValidation {
  if (reason === "AUTRE" && !comment?.trim()) {
    return { ok: false, error: "comment_required" };
  }
  return { ok: true };
}

export type UserReportEligibility =
  | { ok: true }
  | { ok: false; error: "cannot_report_self" };

// Signaler un utilisateur n'exige aucune interaction préalable (contrairement
// aux avis) — un profil suspect peut être repéré sans avoir échangé de
// message, tout comme le signalement d'une annonce ne l'exige pas non plus.
export function checkCanReportUser({ isSelf }: { isSelf: boolean }): UserReportEligibility {
  if (isSelf) return { ok: false, error: "cannot_report_self" };
  return { ok: true };
}

export type ReportModerationAction = "resolve" | "dismiss";

export type ReportTransition =
  | { ok: true; newStatus: "TRAITE" | "REJETE" }
  | { ok: false; error: "invalid_transition" };

// Un signalement OUVERT se referme une fois pour toutes (traité ou rejeté) —
// pas de réouverture dans ce lot.
export function computeReportTransition(
  currentStatus: ReportStatus,
  action: ReportModerationAction
): ReportTransition {
  if (currentStatus !== "OUVERT") {
    return { ok: false, error: "invalid_transition" };
  }
  return { ok: true, newStatus: action === "resolve" ? "TRAITE" : "REJETE" };
}

// Seuil de signalements CONFIRMÉS (jamais de simples signalements ouverts ou
// rejetés — un signalement non vérifié ne doit jamais déclencher d'action
// automatique, cf. décision du Lot 9) au-delà duquel une annonce est
// suspendue automatiquement.
export const AUTO_SUSPEND_LISTING_THRESHOLD = 3;

export function shouldAutoSuspendListing(confirmedReportCount: number): boolean {
  return confirmedReportCount >= AUTO_SUSPEND_LISTING_THRESHOLD;
}

// Même principe, pour les signalements d'utilisateur (Lot 31 — comble l'écart
// documenté depuis le Lot 21 : la suspension automatique ne s'appliquait
// jusqu'ici qu'aux annonces, jamais aux comptes eux-mêmes).
export const AUTO_SUSPEND_USER_THRESHOLD = 3;

export function shouldAutoSuspendUser(confirmedReportCount: number): boolean {
  return confirmedReportCount >= AUTO_SUSPEND_USER_THRESHOLD;
}
