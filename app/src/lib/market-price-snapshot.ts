import { prisma } from "@/lib/prisma";

export type TrendPoint = {
  snapshotAt: Date;
  low: number;
  mid: number;
  high: number;
  sampleSize: number;
};

const MIN_SAMPLE = 3;
const SNAPSHOT_INTERVAL_DAYS = 6;

export async function takeMarketSnapshots(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - SNAPSHOT_INTERVAL_DAYS * 24 * 60 * 60 * 1000);
  const recent = await prisma.marketPriceSnapshot.findFirst({
    where: { snapshotAt: { gte: cutoff } },
    select: { id: true },
  });
  if (recent) return 0;

  const rows = await prisma.$queryRaw<
    { brandId: number; modelId: number; year: number; p25: number; p50: number; p75: number; cnt: number }[]
  >`
    SELECT
      "brandId",
      "modelId",
      year,
      PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY price)::integer AS p25,
      PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY price)::integer AS p50,
      PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY price)::integer AS p75,
      COUNT(*)::integer AS cnt
    FROM "Listing"
    WHERE status = 'PUBLIEE'
      AND "brandId" IS NOT NULL
      AND "modelId" IS NOT NULL
    GROUP BY "brandId", "modelId", year
    HAVING COUNT(*) >= ${MIN_SAMPLE}
  `;

  if (rows.length === 0) return 0;

  await prisma.marketPriceSnapshot.createMany({
    data: rows.map((r) => ({
      brandId: r.brandId,
      modelId: r.modelId,
      year: r.year,
      low: r.p25,
      mid: r.p50,
      high: r.p75,
      sampleSize: r.cnt,
      snapshotAt: now,
    })),
  });

  return rows.length;
}

export async function getMarketPriceTrend(modelId: number, year?: number): Promise<TrendPoint[]> {
  const snapshots = await prisma.marketPriceSnapshot.findMany({
    where: { modelId, ...(year ? { year } : {}) },
    orderBy: { snapshotAt: "asc" },
    select: { snapshotAt: true, low: true, mid: true, high: true, sampleSize: true, year: true },
  });

  if (!year && snapshots.length > 0) {
    const byDate = new Map<string, { low: number[]; mid: number[]; high: number[]; sampleSize: number; snapshotAt: Date }>();
    for (const s of snapshots) {
      const key = s.snapshotAt.toISOString();
      let entry = byDate.get(key);
      if (!entry) {
        entry = { low: [], mid: [], high: [], sampleSize: 0, snapshotAt: s.snapshotAt };
        byDate.set(key, entry);
      }
      entry.low.push(s.low);
      entry.mid.push(s.mid);
      entry.high.push(s.high);
      entry.sampleSize += s.sampleSize;
    }
    return [...byDate.values()].map((e) => ({
      snapshotAt: e.snapshotAt,
      low: Math.round(median(e.low)),
      mid: Math.round(median(e.mid)),
      high: Math.round(median(e.high)),
      sampleSize: e.sampleSize,
    }));
  }

  return snapshots.map((s) => ({
    snapshotAt: s.snapshotAt,
    low: s.low,
    mid: s.mid,
    high: s.high,
    sampleSize: s.sampleSize,
  }));
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[m - 1] + sorted[m]) / 2 : sorted[m];
}

const RETENTION_MONTHS = 24;

export async function sweepOldSnapshots(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - RETENTION_MONTHS);
  const result = await prisma.marketPriceSnapshot.deleteMany({ where: { snapshotAt: { lt: cutoff } } });
  return result.count;
}
