"use client";

import { useId, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";

type WilayaOption = { id: number; nomFr: string; nomAr: string };

export type EquipementFilterValues = {
  q?: string;
  priceMin?: string;
  priceMax?: string;
  condition?: string;
  wilayaId?: string;
};

export function EquipementFilters({
  wilayas,
  initialValues,
}: {
  wilayas: WilayaOption[];
  initialValues: EquipementFilterValues;
}) {
  const t = useTranslations("EquipementSearch");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const [q, setQ] = useState(initialValues.q ?? "");
  const [priceMin, setPriceMin] = useState(initialValues.priceMin ?? "");
  const [priceMax, setPriceMax] = useState(initialValues.priceMax ?? "");
  const [condition, setCondition] = useState(initialValues.condition ?? "");
  const [wilayaId, setWilayaId] = useState(initialValues.wilayaId ?? "");

  function apply(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (priceMin) params.set("priceMin", priceMin);
    if (priceMax) params.set("priceMax", priceMax);
    if (condition) params.set("condition", condition);
    if (wilayaId) params.set("wilayaId", wilayaId);
    const qs = params.toString();
    router.push(`${pathname}${qs ? `?${qs}` : ""}`);
  }

  function reset() {
    setQ("");
    setPriceMin("");
    setPriceMax("");
    setCondition("");
    setWilayaId("");
    router.push(pathname);
  }

  const inputClass =
    "w-full rounded-md border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500";
  const labelClass = "block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1";
  // Lot 269 (audit D3) — chaque champ a un libellé associé (htmlFor/id) : un lecteur d'écran annonçait des champs sans nom.
  const ids = { search: useId(), priceMin: useId(), priceMax: useId(), condition: useId(), wilaya: useId() };

  return (
    <form onSubmit={apply} className="space-y-4">
      <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{t("filterTitle")}</p>

      {/* Recherche texte */}
      <div>
        <input
          id={ids.search}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPlaceholder")}
          className={inputClass}
        />
      </div>

      {/* Prix */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor={ids.priceMin} className={labelClass}>{t("priceMin")}</label>
          <input
            id={ids.priceMin}
            type="number"
            min={0}
            value={priceMin}
            onChange={(e) => setPriceMin(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor={ids.priceMax} className={labelClass}>{t("priceMax")}</label>
          <input
            id={ids.priceMax}
            type="number"
            min={0}
            value={priceMax}
            onChange={(e) => setPriceMax(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      {/* État */}
      <div>
        <label htmlFor={ids.condition} className={labelClass}>{t("conditionLabel")}</label>
        <select
          id={ids.condition}
          value={condition}
          onChange={(e) => setCondition(e.target.value)}
          className={inputClass}
        >
          <option value="">{t("conditionAll")}</option>
          <option value="NEUF">{t("conditionNeuf")}</option>
          <option value="OCCASION">{t("conditionOccasion")}</option>
        </select>
      </div>

      {/* Wilaya */}
      <div>
        <label htmlFor={ids.wilaya} className={labelClass}>{t("wilayaLabel")}</label>
        <select
          id={ids.wilaya}
          value={wilayaId}
          onChange={(e) => setWilayaId(e.target.value)}
          className={inputClass}
        >
          <option value="">{t("wilayaAll")}</option>
          {wilayas.map((w) => (
            <option key={w.id} value={String(w.id)}>
              {locale === "ar" ? w.nomAr : w.nomFr}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          className="flex-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-3 transition-colors"
        >
          {t("searchButton")}
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded-md border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm py-2 px-3 transition-colors"
        >
          {t("resetFilters")}
        </button>
      </div>
    </form>
  );
}
