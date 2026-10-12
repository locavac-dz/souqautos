import type { TrendPoint } from "@/lib/market-price-snapshot";

const W = 600;
const H = 200;
const PAD_X = 56;
const PAD_Y = 24;
const INNER_W = W - PAD_X * 2;
const INNER_H = H - PAD_Y * 2;

export function MarketPriceTrend({
  points,
  label,
  locale,
}: {
  points: TrendPoint[];
  label: string;
  locale: string;
}) {
  if (points.length < 2) return null;

  const numberLocale = locale === "ar" ? "ar-DZ" : "fr-DZ";
  const minPrice = Math.min(...points.map((p) => p.low));
  const maxPrice = Math.max(...points.map((p) => p.high));
  const priceRange = maxPrice - minPrice || 1;
  const padding = priceRange * 0.1;
  const yMin = minPrice - padding;
  const yMax = maxPrice + padding;

  const tStart = points[0].snapshotAt.getTime();
  const tEnd = points[points.length - 1].snapshotAt.getTime();
  const tRange = tEnd - tStart || 1;

  function x(t: Date) {
    return PAD_X + ((t.getTime() - tStart) / tRange) * INNER_W;
  }
  function y(price: number) {
    return PAD_Y + (1 - (price - yMin) / (yMax - yMin)) * INNER_H;
  }

  const bandPath =
    points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.snapshotAt).toFixed(1)},${y(p.high).toFixed(1)}`).join(" ") +
    " " +
    [...points].reverse().map((p, i) => `${i === 0 ? "L" : "L"}${x(p.snapshotAt).toFixed(1)},${y(p.low).toFixed(1)}`).join(" ") +
    " Z";

  const midLine = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.snapshotAt).toFixed(1)},${y(p.mid).toFixed(1)}`).join(" ");

  const ticks = computeYTicks(yMin, yMax, 4);

  const dateLabel = (d: Date) =>
    d.toLocaleDateString(numberLocale, { month: "short", year: "2-digit" });

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={label}
        className="w-full h-auto"
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={PAD_X}
              x2={W - PAD_X}
              y1={y(tick)}
              y2={y(tick)}
              className="stroke-slate-200 dark:stroke-slate-700"
              strokeWidth={0.5}
            />
            <text
              x={PAD_X - 6}
              y={y(tick) + 3}
              textAnchor="end"
              className="fill-slate-400 dark:fill-slate-500"
              fontSize={9}
            >
              {formatCompact(tick, numberLocale)}
            </text>
          </g>
        ))}

        <path d={bandPath} className="fill-amber-100 dark:fill-amber-900/30" />

        <path d={midLine} fill="none" className="stroke-amber-500" strokeWidth={2} strokeLinejoin="round" />

        {points.map((p) => (
          <circle
            key={p.snapshotAt.toISOString()}
            cx={x(p.snapshotAt)}
            cy={y(p.mid)}
            r={3}
            className="fill-amber-500"
          >
            <title>
              {dateLabel(p.snapshotAt)} : {p.mid.toLocaleString(numberLocale)} DA
              {"\n"}({p.low.toLocaleString(numberLocale)} – {p.high.toLocaleString(numberLocale)})
            </title>
          </circle>
        ))}
      </svg>
      <figcaption className="mt-1 flex justify-between text-xs text-slate-400" dir="ltr">
        <span>{dateLabel(points[0].snapshotAt)}</span>
        <span>{dateLabel(points[points.length - 1].snapshotAt)}</span>
      </figcaption>
    </figure>
  );
}

function computeYTicks(min: number, max: number, count: number): number[] {
  const range = max - min;
  const raw = range / count;
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = Math.ceil(raw / magnitude) * magnitude;
  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max && ticks.length < count + 2; v += step) {
    ticks.push(v);
  }
  return ticks;
}

function formatCompact(value: number, locale: string): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return value.toLocaleString(locale);
}
