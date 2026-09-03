export type WeekBucket = { weekStart: Date; count: number };

function startOfWeek(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay(); // 0 (dimanche) à 6
  const diffToMonday = (day + 6) % 7;
  d.setUTCDate(d.getUTCDate() - diffToMonday);
  return d;
}

// Répartit une liste de dates dans des tranches hebdomadaires (lundi-dimanche),
// des `weeks` dernières semaines jusqu'à `now` incluse — pur et testable
// indépendamment de Prisma, comme les autres formules du projet.
export function bucketByWeek(dates: Date[], weeks: number, now: Date = new Date()): WeekBucket[] {
  const currentWeekStart = startOfWeek(now);
  const buckets: WeekBucket[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = new Date(currentWeekStart);
    weekStart.setUTCDate(weekStart.getUTCDate() - i * 7);
    buckets.push({ weekStart, count: 0 });
  }

  const indexByTime = new Map(buckets.map((b, i) => [b.weekStart.getTime(), i]));

  for (const date of dates) {
    const weekStart = startOfWeek(date);
    const index = indexByTime.get(weekStart.getTime());
    if (index !== undefined) {
      buckets[index].count += 1;
    }
  }

  return buckets;
}
