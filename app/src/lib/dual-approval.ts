// Lot 278 — double validation des paiements par virement au-dessus d'un montant.
//
// Au-dessus du seuil (réglage « Seuil de double validation » dans /admin/parametres, null = désactivé), un
// virement n'est confirmé qu'après l'approbation de DEUX administrateurs différents : la première validation
// est enregistrée (firstApprovedBy/At), la commande reste EN_ATTENTE ; la seconde, par une autre personne,
// déclenche l'activation. Le refus reste à une seule personne (aucun argent ne bouge). Les paiements en ligne
// (Chargily) sont exclus : le prestataire a déjà encaissé, l'humain ne fait que relire.
import type { PaymentProvider } from "@prisma/client";

export function requiresDualApproval(input: { amountDzd: number; provider: PaymentProvider; thresholdDzd: number | null }): boolean {
  if (input.thresholdDzd === null) return false;
  if (input.provider !== "VIREMENT") return false;
  return input.amountDzd >= input.thresholdDzd;
}

export type ApprovalStep = "confirm" | "first_approval" | "same_approver";

// Pur : que fait cette approbation ?
export function decideApprovalStep(input: { requiresDual: boolean; firstApprovedById: string | null; userId: string }): ApprovalStep {
  if (!input.requiresDual) return "confirm";
  if (!input.firstApprovedById) return "first_approval";
  if (input.firstApprovedById === input.userId) return "same_approver";
  return "confirm";
}

export const MIN_DUAL_APPROVAL_THRESHOLD_DZD = 1;
export const MAX_DUAL_APPROVAL_THRESHOLD_DZD = 100_000_000;

export type ThresholdValidation = { ok: true } | { ok: false; error: "invalid_dual_approval_threshold" };

export function validateDualApprovalThreshold(value: number | null): ThresholdValidation {
  if (value === null) return { ok: true };
  if (!Number.isInteger(value) || value < MIN_DUAL_APPROVAL_THRESHOLD_DZD || value > MAX_DUAL_APPROVAL_THRESHOLD_DZD) {
    return { ok: false, error: "invalid_dual_approval_threshold" };
  }
  return { ok: true };
}

// Avec un seul administrateur, le seuil bloquerait toute approbation au-dessus : à signaler, jamais à masquer.
export const MIN_ADMINS_FOR_DUAL_APPROVAL = 2;

export function dualApprovalBlocksAlone(input: { thresholdDzd: number | null; adminCount: number }): boolean {
  return input.thresholdDzd !== null && input.adminCount < MIN_ADMINS_FOR_DUAL_APPROVAL;
}
