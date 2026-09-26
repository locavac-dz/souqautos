"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

type ModelRow = { id: number; name: string; brandId: number };
type BrandRow = { id: number; name: string; models: ModelRow[] };
type WilayaRow = { id: number; nomFr: string; nomAr: string };

export type EstimateFormValues = {
  brandId?: string;
  modelId?: string;
  year?: string;
  mileage?: string;
  wilayaId?: string;
};

export function EstimateForm({
  brands,
  wilayas,
  initialValues,
}: {
  brands: BrandRow[];
  wilayas: WilayaRow[];
  initialValues: EstimateFormValues;
}) {
  const t = useTranslations("Estimate");
  const tSearch = useTranslations("Search");
  const tWizard = useTranslations("Wizard");
  const locale = useLocale();
  const router = useRouter();
  const [values, setValues] = useState<EstimateFormValues>(initialValues);

  const selectedBrand = brands.find((b) => b.id === Number(values.brandId));

  function set<K extends keyof EstimateFormValues>(key: K, value: string) {
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
    router.push(`/cote-souq-auto?${query.toString()}`);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label={tSearch("brand")}>
        <select
          required
          value={values.brandId ?? ""}
          onChange={(e) => set("brandId", e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
        >
          <option value="" disabled>
            {tSearch("any")}
          </option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </Field>

      {selectedBrand && (
        <Field label={tSearch("model")}>
          <select
            required
            value={values.modelId ?? ""}
            onChange={(e) => set("modelId", e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
          >
            <option value="" disabled>
              {tSearch("any")}
            </option>
            {selectedBrand.models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>
      )}

      <Field label={tWizard("year")}>
        <input
          type="number"
          inputMode="numeric"
          min={1970}
          value={values.year ?? ""}
          onChange={(e) => set("year", e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
        />
      </Field>

      <Field label={tWizard("mileage")}>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={values.mileage ?? ""}
          onChange={(e) => set("mileage", e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
        />
      </Field>

      <Field label={tSearch("wilaya")}>
        <select
          value={values.wilayaId ?? ""}
          onChange={(e) => set("wilayaId", e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
        >
          <option value="">{tSearch("any")}</option>
          {wilayas.map((w) => (
            <option key={w.id} value={w.id}>
              {locale === "ar" ? w.nomAr : w.nomFr}
            </option>
          ))}
        </select>
      </Field>

      <button
        type="submit"
        disabled={!values.brandId || !values.modelId}
        className="w-full rounded-md bg-slate-900 px-4 py-2.5 font-medium text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
      >
        {t("submit")}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    // Le champ est DANS l'étiquette : le lecteur d'écran annonce « Année » en entrant dans le champ (l'ancienne
    // étiquette voisine n'y était reliée par aucun `for`/`id`).
    <label className="block">
      <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{label}</span>
      {children}
    </label>
  );
}
