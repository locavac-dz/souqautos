export const AI_CADENCE = {
  magArticle: { intervalDays: 7, label: "magArticle" as const },
  pressReview: { intervalDays: 7, label: "pressReview" as const },
  guide: { intervalDays: 30, label: "guide" as const },
} as const;

export type AiCadenceKey = keyof typeof AI_CADENCE;
export const AI_CADENCE_KEYS: AiCadenceKey[] = ["magArticle", "pressReview", "guide"];

export type AiCadenceStatus =
  | { status: "due"; overdueDays: number }
  | { status: "ok"; daysUntilNext: number }
  | { status: "disabled" };

export function aiCadenceStatus(
  lastCreatedAt: Date | null,
  intervalDays: number,
  now: Date,
): AiCadenceStatus {
  if (!lastCreatedAt) return { status: "due", overdueDays: 0 };
  const elapsedMs = now.getTime() - lastCreatedAt.getTime();
  const elapsedDays = Math.floor(elapsedMs / (24 * 60 * 60 * 1000));
  if (elapsedDays >= intervalDays) {
    return { status: "due", overdueDays: elapsedDays - intervalDays };
  }
  return { status: "ok", daysUntilNext: intervalDays - elapsedDays };
}

export type AiStats = {
  totalGenerated: number;
  pendingReview: number;
  published: number;
};
