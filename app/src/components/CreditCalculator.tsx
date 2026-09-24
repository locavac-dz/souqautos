"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  computeCredit,
  CREDIT_DURATION_OPTIONS,
  CREDIT_DEFAULT_RATE,
  CREDIT_DEFAULT_MONTHS,
} from "@/lib/credit-calculator";

export function CreditCalculator({ price }: { price: number }) {
  const t = useTranslations("CreditCalculator");
  const [downPayment, setDownPayment] = useState(0);
  const [annualRate, setAnnualRate] = useState(CREDIT_DEFAULT_RATE);
  const [months, setMonths] = useState(CREDIT_DEFAULT_MONTHS);

  const result = useMemo(
    () => computeCredit({ price, downPayment, annualRatePct: annualRate, durationMonths: months }),
    [price, downPayment, annualRate, months]
  );

  const fmt = (n: number) => n.toLocaleString("fr-DZ");
  const maxDown = Math.max(0, price - 1);

  return (
    <div className="mt-6">
      <h2 className="text-sm font-medium text-slate-700 mb-2">{t("title")}</h2>
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-4">

        {/* Apport */}
        <div>
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>{t("downPayment")}</span>
            <span className="font-medium text-slate-700">{fmt(downPayment)} DA</span>
          </div>
          <input
            type="range"
            min={0}
            max={maxDown}
            step={Math.max(1, Math.round(price / 100))}
            value={downPayment}
            onChange={(e) => setDownPayment(Number(e.target.value))}
            className="w-full accent-emerald-600"
            aria-label={t("downPayment")}
          />
          <div className="flex justify-between text-xs text-slate-500 mt-0.5">
            <span>0</span>
            <span>{fmt(maxDown)} DA</span>
          </div>
        </div>

        {/* Taux */}
        <div>
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>{t("annualRate")}</span>
            <span className="font-medium text-slate-700">{annualRate.toFixed(1)} %</span>
          </div>
          <input
            type="range"
            min={1}
            max={20}
            step={0.5}
            value={annualRate}
            onChange={(e) => setAnnualRate(Number(e.target.value))}
            className="w-full accent-emerald-600"
            aria-label={t("annualRate")}
          />
          <div className="flex justify-between text-xs text-slate-500 mt-0.5">
            <span>1 %</span>
            <span>20 %</span>
          </div>
        </div>

        {/* Durée */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 shrink-0">{t("duration")}</span>
          <div className="flex flex-wrap gap-1.5">
            {CREDIT_DURATION_OPTIONS.map((m) => (
              <button
                key={m}
                onClick={() => setMonths(m)}
                className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                  months === m
                    ? "bg-emerald-700 border-emerald-700 text-white"
                    : "border-slate-300 text-slate-600 hover:border-emerald-400"
                }`}
              >
                {t("months", { count: m })}
              </button>
            ))}
          </div>
        </div>

        {/* Résultat */}
        {result ? (
          <div className="rounded-md bg-white border border-slate-200 p-3">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-slate-500">{t("monthlyPayment")}</span>
              <span className="text-xl font-semibold text-emerald-700">
                {fmt(result.monthly)} <span className="text-sm font-normal text-slate-500">{t("perMonth")}</span>
              </span>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-100 grid grid-cols-2 gap-x-4 text-xs text-slate-500">
              <span>{t("totalCost")}</span>
              <span className="text-end font-medium text-slate-700">{fmt(result.total)} DA</span>
              <span>{t("totalInterest")}</span>
              <span className="text-end font-medium text-slate-700">{fmt(result.interest)} DA</span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-500 text-center">{t("noLoan")}</p>
        )}

        <p className="text-xs text-slate-500">{t("disclaimer")}</p>
      </div>
    </div>
  );
}
