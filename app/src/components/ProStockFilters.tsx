"use client";

import { useState, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { PRICE_STEPS_DZD, yearOptions, optionsWithCurrent, normalizeFilterValue } from "@/lib/search-filter-options";

type BrandOption = { id: number; name: string };

export type StockFilterValues = {
  brandId?: string;
  priceMin?: string;
  priceMax?: string;
  yearMin?: string;
  yearMax?: string;
};

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_STEPS = yearOptions(CURRENT_YEAR);

export function ProStockFilters({
  accountId,
  brands,
  initialValues,
}: {
  accountId: string;
  brands: BrandOption[];
  initialValues: StockFilterValues;
}) {
  const t = useTranslations("Search");
  const tPro = useTranslations("Pro");
  const locale = useLocale();
  const numberLocale = locale === "ar" ? "ar-DZ" : "fr-DZ";
  const router = useRouter();
  const [values, setValues] = useState<StockFilterValues>(initialValues);

  useEffect(() => {
    setValues(initialValues);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValues.brandId, initialValues.priceMin, initialValues.priceMax, initialValues.yearMin, initialValues.yearMax]);

  function set(key: keyof StockFilterValues, value: string) {
    setValues((prev) => ({ ...prev, [key]: value || undefined }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const query = new URLSearchParams();
    Object.entries(values).forEach(([k, v]) => {
      if (v) query.set(k, v);
    });
    router.push(`/pro/${accountId}?${query.toString()}`);
  }

  function reset() {
    setValues({});
    router.push(`/pro/${accountId}`);
  }

  const hasFilters = Object.values(values).some(Boolean);

  return (
    <form
      onSubmit={submit}
      className="mb-4 flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3"
    >
      {brands.length > 0 && (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">{t("brand")}</label>
          <select
            value={values.brandId ?? ""}
            onChange={(e) => set("brandId", e.target.value)}
            className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">{t("any")}</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-500">{t("yearRange")}</label>
        <div className="flex items-center gap-1">
          <select
            value={normalizeFilterValue(values.yearMin)}
            onChange={(e) => set("yearMin", e.target.value)}
            className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">{t("min")}</option>
            {optionsWithCurrent(YEAR_STEPS, values.yearMin, "desc").map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <span className="text-xs text-slate-400">–</span>
          <select
            value={normalizeFilterValue(values.yearMax)}
            onChange={(e) => set("yearMax", e.target.value)}
            className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">{t("max")}</option>
            {optionsWithCurrent(YEAR_STEPS, values.yearMax, "desc").map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-500">{t("priceRange")}</label>
        <div className="flex items-center gap-1">
          <select
            value={normalizeFilterValue(values.priceMin)}
            onChange={(e) => set("priceMin", e.target.value)}
            className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">{t("min")}</option>
            {optionsWithCurrent(PRICE_STEPS_DZD, values.priceMin, "asc").map((n) => (
              <option key={n} value={n}>
                {n.toLocaleString(numberLocale)}
              </option>
            ))}
          </select>
          <span className="text-xs text-slate-400">–</span>
          <select
            value={normalizeFilterValue(values.priceMax)}
            onChange={(e) => set("priceMax", e.target.value)}
            className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">{t("max")}</option>
            {optionsWithCurrent(PRICE_STEPS_DZD, values.priceMax, "asc").map((n) => (
              <option key={n} value={n}>
                {n.toLocaleString(numberLocale)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-end gap-2">
        <button
          type="submit"
          className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
        >
          {t("submit")}
        </button>
        {hasFilters && (
          <button
            type="button"
            onClick={reset}
            className="text-sm text-slate-500 hover:text-slate-900"
          >
            {tPro("stockFilterReset")}
          </button>
        )}
      </div>
    </form>
  );
}
