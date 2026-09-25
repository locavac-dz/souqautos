import type { MonthPoint } from "@/lib/catalogue-stats";

// Lot 164 — graphique d'évolution du prix moyen mensuel, HTML+CSS pur (aucune bibliothèque).
export function MonthlyPriceBars({
  points,
  label,
  locale,
}: {
  points: MonthPoint[];
  label: string;
  locale: string;
}) {
  const max = Math.max(1, ...points.map((p) => p.avgPrice));
  const numberLocale = locale === "ar" ? "ar-DZ" : "fr-DZ";

  const monthLabel = (m: string) => {
    const [year, month] = m.split("-");
    return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString(numberLocale, {
      month: "short",
      year: "2-digit",
    });
  };

  return (
    <figure className="m-0">
      <div
        role="img"
        aria-label={label}
        className="flex h-24 items-end gap-0.5 border-b border-slate-200 dark:border-slate-600"
        dir="ltr"
      >
        {points.map((p) => (
          <div
            key={p.month}
            title={`${monthLabel(p.month)} : ${p.avgPrice.toLocaleString(numberLocale)} DA (${p.count})`}
            className="min-w-px flex-1 rounded-t-sm bg-amber-400 hover:bg-amber-500 transition-colors"
            style={{ height: `${Math.max(4, (p.avgPrice / max) * 100)}%` }}
          />
        ))}
      </div>
      {points.length >= 2 && (
        <figcaption className="mt-1 flex justify-between text-xs text-slate-400" dir="ltr">
          <span>{monthLabel(points[0].month)}</span>
          <span>{monthLabel(points[points.length - 1].month)}</span>
        </figcaption>
      )}
    </figure>
  );
}
