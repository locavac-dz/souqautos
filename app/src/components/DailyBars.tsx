import type { DayPoint } from "@/lib/pro-stats";

// Lot 122 — histogramme par jour, en HTML et CSS seulement (aucune bibliothèque de graphiques).
// Accessible : le graphique est décrit dans son ensemble (`label`) et chaque barre porte sa valeur.
export function DailyBars({
  points,
  label,
  locale,
  barClass,
}: {
  points: DayPoint[];
  label: string;
  locale: string;
  barClass: string;
}) {
  const max = Math.max(1, ...points.map((p) => p.value));
  const numberLocale = locale === "ar" ? "ar-DZ" : "fr-DZ";
  const dayLabel = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString(numberLocale, { day: "numeric", month: "short", timeZone: "UTC" });

  return (
    <figure className="m-0">
      <div role="img" aria-label={label} className="flex h-24 items-end gap-px border-b border-slate-200 dark:border-slate-600" dir="ltr">
        {points.map((p) => (
          <div
            key={p.day}
            title={`${dayLabel(p.day)} : ${p.value.toLocaleString(numberLocale)}`}
            className={`min-w-px flex-1 rounded-t-sm ${p.value > 0 ? barClass : "bg-slate-200 dark:bg-slate-600"}`}
            style={{ height: p.value > 0 ? `${Math.max(4, (p.value / max) * 100)}%` : "2px" }}
          />
        ))}
      </div>
      <figcaption className="mt-1 flex justify-between text-xs text-slate-500 dark:text-slate-400" dir="ltr">
        <span>{dayLabel(points[0].day)}</span>
        <span>{dayLabel(points[points.length - 1].day)}</span>
      </figcaption>
    </figure>
  );
}
