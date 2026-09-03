"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

type ModelRow = { id: number; name: string; brandId: number };
type BrandRow = { id: number; name: string; models: ModelRow[] };
type WilayaRow = { id: number; nomFr: string; nomAr: string };

export type SearchFilterValues = {
  q?: string;
  category?: string;
  brandId?: string;
  modelId?: string;
  wilayaId?: string;
  priceMin?: string;
  priceMax?: string;
  yearMin?: string;
  yearMax?: string;
  mileageMax?: string;
  fuelType?: string;
  gearbox?: string;
  condition?: string;
};

const CATEGORY_KEY: Record<string, string> = {
  VOITURE: "categoryVoiture",
  UTILITAIRE: "categoryUtilitaire",
  POIDS_LOURD: "categoryPoidsLourd",
  DEUX_ROUES: "categoryDeuxRoues",
  AUTRE: "categoryAutre",
};

export function SearchFilters({
  brands,
  wilayas,
  initialValues,
  compact = false,
}: {
  brands: BrandRow[];
  wilayas: WilayaRow[];
  initialValues: SearchFilterValues;
  compact?: boolean;
}) {
  const t = useTranslations("Search");
  const tWizard = useTranslations("Wizard");
  const locale = useLocale();
  const router = useRouter();
  const [values, setValues] = useState<SearchFilterValues>(initialValues);

  const selectedBrand = brands.find((b) => b.id === Number(values.brandId));

  function set<K extends keyof SearchFilterValues>(key: K, value: string) {
    setValues((prev) => ({
      ...prev,
      [key]: value || undefined,
      ...(key === "brandId" ? { modelId: undefined } : {}),
    }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const query = new URLSearchParams();
    Object.entries(values).forEach(([key, value]) => {
      if (value) query.set(key, value);
    });
    router.push(`/recherche?${query.toString()}`);
  }

  return (
    <form onSubmit={submit} className={compact ? "flex flex-col sm:flex-row gap-2" : "space-y-4"}>
      <input
        type="text"
        value={values.q ?? ""}
        onChange={(e) => set("q", e.target.value)}
        placeholder={t("queryPlaceholder")}
        className={
          compact
            ? "flex-1 rounded-md border border-slate-300 px-4 py-2.5"
            : "w-full rounded-md border border-slate-300 px-3 py-2"
        }
      />

      {compact ? (
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-5 py-2.5 font-medium text-white hover:bg-slate-700"
        >
          {t("submit")}
        </button>
      ) : (
        <>
          <Field label={t("category")}>
            <select
              value={values.category ?? ""}
              onChange={(e) => set("category", e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 bg-white"
            >
              <option value="">{t("any")}</option>
              {Object.entries(CATEGORY_KEY).map(([value, key]) => (
                <option key={value} value={value}>
                  {tWizard(key)}
                </option>
              ))}
            </select>
          </Field>

          <Field label={t("brand")}>
            <select
              value={values.brandId ?? ""}
              onChange={(e) => set("brandId", e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 bg-white"
            >
              <option value="">{t("any")}</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>

          {selectedBrand && (
            <Field label={t("model")}>
              <select
                value={values.modelId ?? ""}
                onChange={(e) => set("modelId", e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 bg-white"
              >
                <option value="">{t("any")}</option>
                {selectedBrand.models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <Field label={t("wilaya")}>
            <select
              value={values.wilayaId ?? ""}
              onChange={(e) => set("wilayaId", e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 bg-white"
            >
              <option value="">{t("any")}</option>
              {wilayas.map((w) => (
                <option key={w.id} value={w.id}>
                  {locale === "ar" ? w.nomAr : w.nomFr}
                </option>
              ))}
            </select>
          </Field>

          <Field label={t("priceRange")}>
            <div className="flex gap-2">
              <input
                type="number"
                min={0}
                placeholder={t("min")}
                value={values.priceMin ?? ""}
                onChange={(e) => set("priceMin", e.target.value)}
                className="w-1/2 rounded-md border border-slate-300 px-3 py-2"
              />
              <input
                type="number"
                min={0}
                placeholder={t("max")}
                value={values.priceMax ?? ""}
                onChange={(e) => set("priceMax", e.target.value)}
                className="w-1/2 rounded-md border border-slate-300 px-3 py-2"
              />
            </div>
          </Field>

          <Field label={t("yearRange")}>
            <div className="flex gap-2">
              <input
                type="number"
                min={1970}
                placeholder={t("min")}
                value={values.yearMin ?? ""}
                onChange={(e) => set("yearMin", e.target.value)}
                className="w-1/2 rounded-md border border-slate-300 px-3 py-2"
              />
              <input
                type="number"
                min={1970}
                placeholder={t("max")}
                value={values.yearMax ?? ""}
                onChange={(e) => set("yearMax", e.target.value)}
                className="w-1/2 rounded-md border border-slate-300 px-3 py-2"
              />
            </div>
          </Field>

          <Field label={t("mileageMax")}>
            <input
              type="number"
              min={0}
              value={values.mileageMax ?? ""}
              onChange={(e) => set("mileageMax", e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </Field>

          <Field label={tWizard("fuelType")}>
            <select
              value={values.fuelType ?? ""}
              onChange={(e) => set("fuelType", e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 bg-white"
            >
              <option value="">{t("any")}</option>
              <option value="ESSENCE">{tWizard("fuelEssence")}</option>
              <option value="DIESEL">{tWizard("fuelDiesel")}</option>
              <option value="GPL">{tWizard("fuelGpl")}</option>
              <option value="HYBRIDE">{tWizard("fuelHybride")}</option>
              <option value="ELECTRIQUE">{tWizard("fuelElectrique")}</option>
            </select>
          </Field>

          <Field label={tWizard("gearbox")}>
            <select
              value={values.gearbox ?? ""}
              onChange={(e) => set("gearbox", e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 bg-white"
            >
              <option value="">{t("any")}</option>
              <option value="MANUELLE">{tWizard("gearboxManuelle")}</option>
              <option value="AUTOMATIQUE">{tWizard("gearboxAutomatique")}</option>
            </select>
          </Field>

          <Field label={tWizard("condition")}>
            <select
              value={values.condition ?? ""}
              onChange={(e) => set("condition", e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 bg-white"
            >
              <option value="">{t("any")}</option>
              <option value="NEUF">{tWizard("conditionNeuf")}</option>
              <option value="OCCASION">{tWizard("conditionOccasion")}</option>
            </select>
          </Field>

          <button
            type="submit"
            className="w-full rounded-md bg-slate-900 px-4 py-2.5 font-medium text-white hover:bg-slate-700"
          >
            {t("submit")}
          </button>
        </>
      )}
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      {children}
    </div>
  );
}
