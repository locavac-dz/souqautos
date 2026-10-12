import { prisma } from "@/lib/prisma";
import { bucketByWeek, type WeekBucket } from "@/lib/product-stats";

// Lot 304 — données du tableau de bord de modération IA.
// Toutes les requêtes sont lancées en parallèle (Promise.all) et les fonctions
// de mise en forme sont pures — testables sans base de données.

const DAYS_30_MS = 30 * 24 * 60 * 60 * 1000;
const WEEKS = 12;

const LISTING_DECISION_ACTIONS = [
  "listing.approve",
  "listing.reject",
  "listing.suspend",
  "listing.auto_publish",
] as const;

export type ModerationKpis = {
  totalModerated: number;
  humanApproved: number;
  autoPublished: number;
  rejected: number;
  suspended: number;
  autoPublishRate: number;
  aiSuspicionRate: number;
  avgModerationHours: number | null;
};

export type FraudScoreBucket = {
  label: string;
  min: number;
  max: number;
  count: number;
};

export const FRAUD_SCORE_RANGES: { label: string; min: number; max: number }[] = [
  { label: "0", min: 0, max: 0 },
  { label: "1–20", min: 1, max: 20 },
  { label: "21–40", min: 21, max: 40 },
  { label: "41–60", min: 41, max: 60 },
  { label: "61–80", min: 61, max: 80 },
  { label: "81–100", min: 81, max: 100 },
];

export type ModerationReport = {
  kpis: ModerationKpis;
  weekly: WeekBucket[];
  fraudDistribution: FraudScoreBucket[];
  pendingCount: number;
  oldestPendingAt: Date | null;
  publishedFlagged: number;
};

export function computeAutoPublishRate(
  autoPublished: number,
  humanApproved: number,
): number {
  const total = autoPublished + humanApproved;
  if (total === 0) return 0;
  return Math.round((autoPublished / total) * 100);
}

export function computeAvgModerationHours(
  pairs: { created: Date; decided: Date }[],
): number | null {
  if (pairs.length === 0) return null;
  const totalMs = pairs.reduce(
    (sum, p) => sum + (p.decided.getTime() - p.created.getTime()),
    0,
  );
  return Math.round((totalMs / pairs.length / (60 * 60 * 1000)) * 10) / 10;
}

export function bucketFraudScores(scores: number[]): FraudScoreBucket[] {
  return FRAUD_SCORE_RANGES.map((range) => ({
    ...range,
    count: scores.filter(
      (s) => s >= range.min && s <= range.max,
    ).length,
  }));
}

export async function loadModerationStats(
  now: Date = new Date(),
): Promise<ModerationReport> {
  const since = new Date(now.getTime() - DAYS_30_MS);

  const [
    auditLogs,
    aiCheckedCount,
    aiSuspicionCount,
    pendingCount,
    oldestPending,
    publishedFlagged,
    allListingDates,
    publishedScores,
  ] = await Promise.all([
    prisma.auditLog.findMany({
      where: {
        action: { in: [...LISTING_DECISION_ACTIONS] },
        createdAt: { gte: since },
      },
      select: {
        action: true,
        targetId: true,
        createdAt: true,
      },
    }),
    prisma.listing.count({
      where: { aiCheckedAt: { not: null } },
    }),
    prisma.listing.count({
      where: { aiSuspicion: { not: null } },
    }),
    prisma.listing.count({
      where: { status: "EN_ATTENTE" },
    }),
    prisma.listing.findFirst({
      where: { status: "EN_ATTENTE" },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
    prisma.listing.count({
      where: { status: "PUBLIEE", fraudScore: { gt: 0 } },
    }),
    prisma.listing.findMany({
      where: { createdAt: { gte: new Date(now.getTime() - WEEKS * 7 * 24 * 60 * 60 * 1000) }, status: { not: "BROUILLON" } },
      select: { createdAt: true },
    }),
    prisma.listing.findMany({
      where: { status: { in: ["PUBLIEE", "EN_ATTENTE"] } },
      select: { fraudScore: true },
    }),
  ]);

  const humanApproved = auditLogs.filter(
    (l) => l.action === "listing.approve",
  ).length;
  const autoPublished = auditLogs.filter(
    (l) => l.action === "listing.auto_publish",
  ).length;
  const rejected = auditLogs.filter(
    (l) => l.action === "listing.reject",
  ).length;
  const suspended = auditLogs.filter(
    (l) => l.action === "listing.suspend",
  ).length;
  const totalModerated = humanApproved + autoPublished + rejected + suspended;

  const humanDecisions = auditLogs.filter(
    (l) => l.action === "listing.approve" || l.action === "listing.reject",
  );
  const listingIds = [...new Set(humanDecisions.map((l) => l.targetId))];
  let pairs: { created: Date; decided: Date }[] = [];
  if (listingIds.length > 0) {
    const listings = await prisma.listing.findMany({
      where: { id: { in: listingIds } },
      select: { id: true, createdAt: true },
    });
    const createdMap = new Map(listings.map((l) => [l.id, l.createdAt]));
    pairs = humanDecisions
      .map((d) => {
        const created = createdMap.get(d.targetId);
        if (!created) return null;
        return { created, decided: d.createdAt };
      })
      .filter((p): p is { created: Date; decided: Date } => p !== null);
  }

  const kpis: ModerationKpis = {
    totalModerated,
    humanApproved,
    autoPublished,
    rejected,
    suspended,
    autoPublishRate: computeAutoPublishRate(autoPublished, humanApproved),
    aiSuspicionRate:
      aiCheckedCount === 0
        ? 0
        : Math.round((aiSuspicionCount / aiCheckedCount) * 100),
    avgModerationHours: computeAvgModerationHours(pairs),
  };

  const weekly = bucketByWeek(
    allListingDates.map((l) => l.createdAt),
    WEEKS,
    now,
  );

  const fraudDistribution = bucketFraudScores(
    publishedScores.map((l) => l.fraudScore),
  );

  return {
    kpis,
    weekly,
    fraudDistribution,
    pendingCount,
    oldestPendingAt: oldestPending?.createdAt ?? null,
    publishedFlagged,
  };
}
