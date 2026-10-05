"use client";

import { useState, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  computeIslamicFinancing,
  ISLAMIC_BANKS,
  ISLAMIC_DURATION_OPTIONS,
  ISLAMIC_DEFAULT_MONTHS,
  ISLAMIC_DEFAULT_BANK_ID,
} from "@/lib/islamic-financing";

export function IslamicFinancingSimulator({ price }: { price: number }) {
  const t = useTranslations("IslamicFinancing");
  const locale = useLocale();

  const [bankId, setBankId] = useState(ISLAMIC_DEFAULT_BANK_ID);
  const [months, setMonths] = useState(ISLAMIC_DEFAULT_MONTHS);
  const [downPayment, setDownPayment] = useState(0);

  const bank = ISLAMIC_BANKS.find((b) => b.id === bankId) ?? ISLAMIC_BANKS[0];
  const maxDown = Math.round(price * 0.8);
  const step = Math.max(1000, Math.round(price * 0.01));

  const result = useMemo(
    () =>
      computeIslamicFinancing({
        price,
        downPayment,
        annualRate: bank.annualRate,
        durationMonths: months,
      }),
    [price, downPayment, bank.annualRate, months]
  );

  const fmt = (n: number) =>
    n.toLocaleString(locale === "ar" ? "ar-DZ" : "fr-DZ");

  return (
    <div className="mt-6">
      <h2 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
        {t("title")}
      </h2>
      <div className="rounded-lg border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950 p-4 space-y-4">

        {/* Sélecteur de banque */}
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{t("bank")}</p>
          <div className="flex flex-wrap gap-2">
            {ISLAMIC_BANKS.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setBankId(b.id)}
                className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                  b.id === bankId
                    ? "bg-teal-700 border-teal-700 text-white"
                    : "border-teal-300 dark:border-teal-700 text-teal-700 dark:text-teal-300 hover:border-teal-500 bg-white dark:bg-teal-900"
                }`}
              >
                {locale === "ar" ? b.nameAr : b.nameFr}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
            {t("annualMarginRate")} : <span className="font-medium">{(bank.annualRate * 100).toFixed(1)} %</span>
          </p>
        </div>

        {/* Apport initial */}
        <div>
          <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span>{t("downPayment")}</span>
            <span className="font-medium text-slate-700 dark:text-slate-300">{fmt(downPayment)} DA</span>
          </div>
          <input
            type="range"
            min={0}
            max={maxDown}
            step={step}
            value={downPayment}
            onChange={(e) => setDownPayment(Number(e.target.value))}
            className="w-full accent-teal-600"
            aria-label={t("downPayment")}
          />
          <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            <span>0 DA</span>
            <span>{fmt(maxDown)} DA</span>
          </div>
        </div>

        {/* Durée */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">{t("duration")}</span>
          <div className="flex flex-wrap gap-2">
            {ISLAMIC_DURATION_OPTIONS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMonths(m)}
                className={`px-2.5 py-1.5 rounded-full text-xs border transition-colors ${
                  months === m
                    ? "bg-teal-700 border-teal-700 text-white"
                    : "border-teal-300 dark:border-teal-700 text-teal-700 dark:text-teal-300 hover:border-teal-500 bg-white dark:bg-teal-900"
                }`}
              >
                {t("months", { count: m })}
              </button>
            ))}
          </div>
        </div>

        {/* Résultat */}
        {result ? (
          <div className="rounded-md bg-white dark:bg-teal-900/40 border border-teal-200 dark:border-teal-700 p-3">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400">{t("monthlyPayment")}</span>
              <span className="text-xl font-semibold text-teal-700 dark:text-teal-300">
                {fmt(result.monthly)}{" "}
                <span className="text-sm font-normal text-slate-500 dark:text-slate-400">{t("perMonth")}</span>
              </span>
            </div>
            <div className="mt-2 pt-2 border-t border-teal-100 dark:border-teal-800 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
              <span>{t("salePrice")}</span>
              <span className="text-end font-medium text-slate-700 dark:text-slate-300">{fmt(result.salePrice)} DA</span>
              <span>{t("totalMargin")}</span>
              <span className="text-end font-medium text-slate-700 dark:text-slate-300">{fmt(result.totalMargin)} DA</span>
              <span>{t("totalCost")}</span>
              <span className="text-end font-medium text-slate-700 dark:text-slate-300">{fmt(result.financed)} DA</span>
            </div>
            <p className="mt-2 text-xs text-teal-700 dark:text-teal-400 font-medium">{t("contractType")}</p>
          </div>
        ) : (
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center">{t("noLoan")}</p>
        )}

        <p className="text-xs text-slate-500 dark:text-slate-400">{t("disclaimer")}</p>
      </div>
    </div>
  );
}
