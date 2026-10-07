"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { formatNumber } from "@/lib/format";

type PricePoint = {
  price: number;
  recordedAt: string; // ISO
};

type Props = {
  /** Points triés du plus ancien au plus récent */
  points: PricePoint[];
  locale: string;
};

const W = 560;
const H = 180;
const PAD = { top: 12, right: 12, bottom: 36, left: 72 };
const CHART_W = W - PAD.left - PAD.right;
const CHART_H = H - PAD.top - PAD.bottom;
const DOT_R = 4;

function niceYTicks(min: number, max: number): number[] {
  const range = max - min || 1;
  const raw = range / 4;
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = Math.ceil(raw / magnitude) * magnitude;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step; v += step) ticks.push(v);
  return ticks.filter((v) => v >= min - step * 0.1 && v <= max + step * 0.1).slice(0, 6);
}

export function PriceHistoryChart({ points, locale }: Props) {
  const t = useTranslations("Listing");
  const [hovered, setHovered] = useState<number | null>(null);

  if (points.length < 2) return null;

  const prices = points.map((p) => p.price);
  const rawMin = Math.min(...prices);
  const rawMax = Math.max(...prices);
  const range = rawMax - rawMin || rawMin * 0.1 || 1;
  const yMin = rawMin - range * 0.15;
  const yMax = rawMax + range * 0.15;

  function xFor(i: number) {
    return PAD.left + (i / (points.length - 1)) * CHART_W;
  }
  function yFor(price: number) {
    return PAD.top + CHART_H - ((price - yMin) / (yMax - yMin)) * CHART_H;
  }

  const polyPts = points.map((p, i) => `${xFor(i).toFixed(1)},${yFor(p.price).toFixed(1)}`).join(" ");

  // Zone de remplissage sous la courbe
  const firstX = xFor(0).toFixed(1);
  const lastX = xFor(points.length - 1).toFixed(1);
  const bottomY = (PAD.top + CHART_H).toFixed(1);
  const fillPath = `M${firstX},${bottomY} L${polyPts.split(" ").map((pt, i) => (i === 0 ? pt : pt)).join(" L")} L${lastX},${bottomY} Z`;

  const yTicks = niceYTicks(rawMin, rawMax);

  const first = points[0].price;
  const last = points[points.length - 1].price;
  const delta = last - first;
  const deltaAbs = Math.abs(delta);
  const deltaPct = first > 0 ? ((Math.abs(delta) / first) * 100).toFixed(1) : "0";
  const isDown = delta < 0;
  const isUp = delta > 0;

  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : "fr-DZ", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(iso));

  const fmtShortDate = (iso: string) =>
    new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : "fr-DZ", {
      day: "numeric",
      month: "short",
    }).format(new Date(iso));

  const hoveredPt = hovered !== null ? points[hovered] : null;
  const hovX = hovered !== null ? xFor(hovered) : 0;
  const hovY = hoveredPt ? yFor(hoveredPt.price) : 0;
  // Positionner le tooltip à gauche ou à droite selon la place disponible
  const tooltipLeft = hovX > W * 0.65;

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {t("priceHistoryTitle")}
        </h2>
        {(isDown || isUp) && (
          <span
            className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
              isDown
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
            }`}
          >
            {isDown ? "▼" : "▲"} {deltaPct}%&nbsp;
            <span className="font-normal">
              ({isDown ? t("priceHistoryDrop") : t("priceHistoryRise")})
            </span>
          </span>
        )}
      </div>

      <div className="relative rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-2 overflow-hidden">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          style={{ maxHeight: 200 }}
          onMouseLeave={() => setHovered(null)}
          aria-label={t("priceHistoryTitle")}
          role="img"
        >
          {/* Lignes de grille Y */}
          {yTicks.map((v) => (
            <g key={v}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={yFor(v).toFixed(1)}
                y2={yFor(v).toFixed(1)}
                stroke="currentColor"
                strokeWidth="0.5"
                className="text-slate-200 dark:text-slate-700"
              />
              <text
                x={PAD.left - 6}
                y={yFor(v)}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize="10"
                className="fill-slate-400 dark:fill-slate-500"
              >
                {formatNumber(v, locale)}
              </text>
            </g>
          ))}

          {/* Labels X */}
          {points.map((p, i) => {
            const x = xFor(i);
            // N'afficher que le premier, le dernier, et les intermédiaires si assez d'espace
            const show =
              i === 0 ||
              i === points.length - 1 ||
              (points.length <= 6 && i > 0 && i < points.length - 1);
            if (!show) return null;
            return (
              <text
                key={i}
                x={x.toFixed(1)}
                y={H - 6}
                textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
                fontSize="10"
                className="fill-slate-400 dark:fill-slate-500"
              >
                {fmtShortDate(p.recordedAt)}
              </text>
            );
          })}

          {/* Zone de remplissage */}
          <path d={fillPath} fill="url(#chartFill)" opacity="0.25" />
          <defs>
            <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0d9488" />
              <stop offset="100%" stopColor="#0d9488" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Ligne principale */}
          <polyline
            points={polyPts}
            fill="none"
            stroke="#0d9488"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Ligne verticale au survol */}
          {hovered !== null && (
            <line
              x1={hovX.toFixed(1)}
              x2={hovX.toFixed(1)}
              y1={PAD.top}
              y2={PAD.top + CHART_H}
              stroke="#0d9488"
              strokeWidth="1"
              strokeDasharray="4 3"
              opacity="0.6"
            />
          )}

          {/* Points interactifs */}
          {points.map((p, i) => (
            <circle
              key={i}
              cx={xFor(i).toFixed(1)}
              cy={yFor(p.price).toFixed(1)}
              r={hovered === i ? DOT_R + 2 : DOT_R}
              fill={hovered === i ? "#0d9488" : "#fff"}
              stroke="#0d9488"
              strokeWidth="2"
              className="cursor-pointer transition-all"
              onMouseEnter={() => setHovered(i)}
            />
          ))}

          {/* Tooltip SVG */}
          {hoveredPt && (() => {
            const tipW = 130;
            const tipH = 38;
            const tipX = tooltipLeft ? hovX - tipW - 10 : hovX + 10;
            const tipY = Math.max(PAD.top, hovY - tipH / 2);
            return (
              <g>
                <rect
                  x={tipX}
                  y={tipY}
                  width={tipW}
                  height={tipH}
                  rx="6"
                  className="fill-slate-900 dark:fill-slate-700"
                  opacity="0.9"
                />
                <text
                  x={tipX + tipW / 2}
                  y={tipY + 13}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="600"
                  fill="#ffffff"
                >
                  {formatNumber(hoveredPt.price, locale)} DA
                </text>
                <text
                  x={tipX + tipW / 2}
                  y={tipY + 28}
                  textAnchor="middle"
                  fontSize="9"
                  fill="#94a3b8"
                >
                  {fmtDate(hoveredPt.recordedAt)}
                </text>
              </g>
            );
          })()}
        </svg>
      </div>

      {/* Légende dessous */}
      <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
        <span>
          {t("priceHistoryInitial")} : <span className="font-medium text-slate-700 dark:text-slate-300">{formatNumber(first, locale)} DA</span>
        </span>
        <span>
          {t("priceHistoryCurrent")} :{" "}
          <span
            className={`font-medium ${
              isDown
                ? "text-emerald-600 dark:text-emerald-400"
                : isUp
                ? "text-red-600 dark:text-red-400"
                : "text-slate-700 dark:text-slate-300"
            }`}
          >
            {formatNumber(last, locale)} DA
          </span>
          {(isDown || isUp) && (
            <span className={isDown ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
              {" "}({isDown ? "-" : "+"}{formatNumber(deltaAbs, locale)} DA)
            </span>
          )}
        </span>
      </div>
    </div>
  );
}
