import type { ListingStatus } from "@prisma/client";

export type ModerationAction = "approve" | "reject" | "suspend";

export type ModerationTransition =
  | { ok: true; newStatus: ListingStatus }
  | { ok: false; error: "invalid_transition" | "reason_required" };

// Règles de transition de statut (§39 du cahier d'architecture) — centralisées ici
// pour être testées indépendamment de la route API et de Prisma.
export function computeModerationTransition(
  currentStatus: ListingStatus,
  action: ModerationAction,
  reason?: string
): ModerationTransition {
  const trimmedReason = reason?.trim();

  switch (action) {
    case "approve":
      if (currentStatus !== "EN_ATTENTE" && currentStatus !== "SUSPENDUE") {
        return { ok: false, error: "invalid_transition" };
      }
      return { ok: true, newStatus: "PUBLIEE" };

    case "reject":
      if (currentStatus !== "EN_ATTENTE") {
        return { ok: false, error: "invalid_transition" };
      }
      if (!trimmedReason) {
        return { ok: false, error: "reason_required" };
      }
      return { ok: true, newStatus: "REFUSEE" };

    case "suspend":
      if (currentStatus !== "PUBLIEE") {
        return { ok: false, error: "invalid_transition" };
      }
      if (!trimmedReason) {
        return { ok: false, error: "reason_required" };
      }
      return { ok: true, newStatus: "SUSPENDUE" };

    default:
      return { ok: false, error: "invalid_transition" };
  }
}
