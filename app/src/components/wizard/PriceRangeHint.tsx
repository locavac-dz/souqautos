"use client";

// Lot 148 — indique au vendeur où son prix se situe par rapport au marché, en temps réel
// pendant qu'il remplit l'étape 5. La fourchette (low/mid/high) vient d'une action serveur
// (base en lecture seule, cache TTL 60 s) ; le badge se recalcule côté client à chaque frappe.

import { useEffect, useMemo, useTransition } from "react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { computePriceBadge } from "@/lib/price-badge";
import { PRICE_BADGE_KEY, PRICE_BADGE_STYLE } from "@/lib/price-badge-style";
import { getPriceEstimate, type EstimateResult } from "@/lib/price-estimate-action";
import type { WizardData } from "./types";

// Calcule la position du prix sur la barre [0 % = low … 100 % = high], clampée.
export function barPosition(price: number, low: number, high: number): number {
  const span = high - low;
  if (span <= 0) return 50;
  return Math.max(0, Math.min(100, ((price - low) / span) * 100));
}

export function PriceRangeHint({ data, price }: { data: WizardData; price?: number }) {
  const t = useTranslations("Wizard");
  const tBadge = useTranslations("PriceBadge");
  const [estimate, setEstimate] = useState<EstimateResult | null>(null);
  const [isPending, startTransition] = useTransition();

  // Clé stable qui change uniquement quand les données utiles à l'estimation changent.
  // equipmentIds est trié pour ne pas déclencher un appel à chaque re-render si le tableau
  // est recréé à l'identique (WizardContext ne garantit pas la stabilité de référence).
  const estimateKey = useMemo(
    () =>
      JSON.stringify({
        b: data.brandId,
        m: data.modelId,
        y: data.year,
        km: data.mileage,
        w: data.wilayaId,
        eq: (data.equipmentIds ?? []).slice().sort().join(","),
      }),
    [data.brandId, data.modelId, data.year, data.mileage, data.wilayaId, data.equipmentIds]
  );

  useEffect(() => {
    if (!data.brandId || !data.modelId) {
      setEstimate(null);
      return;
    }
    startTransition(async () => {
      const result = await getPriceEstimate({
        brandId: data.brandId!,
        modelId: data.modelId!,
        year: data.year,
        mileage: data.mileage,
        wilayaId: data.wilayaId,
        equipmentIds: data.equipmentIds,
      });
      setEstimate(result);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estimateKey]);

  if (isPending && !estimate) {
    return <p className="mt-3 text-xs text-slate-400">{t("priceEstimateLoading")}</p>;
  }
  if (!estimate) return null;

  const { low, mid, high, sampleSize } = estimate;
  const priceBadge = price && price > 0 ? computePriceBadge(price, mid, sampleSize) : null;
  const markerPos = price && price > 0 ? barPosition(price, low, high) : null;

  const fmt = (n: number) => n.toLocaleString("fr-DZ");

  return (
    <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-4 text-sm">
      {/* En-tête */}
      <div className="flex items-center justify-between mb-3">
        <span className="font-medium text-slate-700 dark:text-slate-300">{t("priceEstimateTitle")}</span>
        <span className="text-xs text-slate-400">
          {t("priceEstimateComparables", { count: sampleSize })}
        </span>
      </div>

      {/* Barre de fourchette */}
      <div className="relative h-3 mb-1">
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald-300 via-amber-300 to-red-400" />
        {markerPos !== null && (
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-5 rounded-sm bg-slate-800 shadow-sm ring-2 ring-white"
            style={{ left: `${markerPos}%` }}
            title={`${fmt(price!)} DA`}
          />
        )}
      </div>

      {/* Étiquettes bas / médiane / élevé */}
      <div className="flex justify-between text-xs text-slate-400 mt-1 mb-3 select-none">
        <span>
          {t("priceEstimateLow")}
          <br />
          <span className="text-slate-600 dark:text-slate-300 font-medium">{fmt(low)} DA</span>
        </span>
        <span className="text-center">
          {t("priceEstimateMedian")}
          <br />
          <span className="text-slate-600 dark:text-slate-300 font-medium">{fmt(mid)} DA</span>
        </span>
        <span className="text-end">
          {t("priceEstimateHigh")}
          <br />
          <span className="text-slate-600 dark:text-slate-300 font-medium">{fmt(high)} DA</span>
        </span>
      </div>

      {/* Badge + écart */}
      {priceBadge ? (
        <div
          className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full border text-xs font-medium ${PRICE_BADGE_STYLE[priceBadge.badge]}`}
        >
          <span>{tBadge(PRICE_BADGE_KEY[priceBadge.badge])}</span>
          <span className="opacity-60">
            {priceBadge.deviationPct > 0
              ? tBadge("deviationAbove", { value: priceBadge.deviationPct })
              : priceBadge.deviationPct < 0
                ? tBadge("deviationBelow", { value: Math.abs(priceBadge.deviationPct) })
                : null}
          </span>
        </div>
      ) : (
        <p className="text-xs text-slate-400">{t("priceEstimateEnterPrice")}</p>
      )}
    </div>
  );
}
