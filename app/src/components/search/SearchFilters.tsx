"use client";

import { cloneElement, isValidElement, useState, useEffect, useRef, type ReactElement } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { ListingCategory } from "@prisma/client";
import { useRouter } from "@/i18n/navigation";
import { filterCatalogueByCategory, modelInCategory } from "@/lib/vehicle-catalogue";
import {
  MILEAGE_STEPS_KM,
  PRICE_STEPS_DZD,
  normalizeFilterValue,
  optionsWithCurrent,
  yearOptions,
} from "@/lib/search-filter-options";
import { PRO_CATEGORIES } from "@/lib/validation/pro-account";

type ModelRow = { id: number; name: string; brandId: number; categories: ListingCategory[] };
type BrandRow = { id: number; name: string; models: ModelRow[] };
type CommuneRow = { id: number; nomFr: string; nomAr: string };
type WilayaRow = { id: number; nomFr: string; nomAr: string; communes: CommuneRow[] };
type EquipmentRow = { id: number; nameFr: string; nameAr: string; category: string };

export type SearchFilterValues = {
  q?: string;
  category?: string;
  brandId?: string;
  modelId?: string;
  wilayaId?: string;
  communeId?: string;
  priceMin?: string;
  priceMax?: string;
  yearMin?: string;
  yearMax?: string;
  mileageMax?: string;
  fuelType?: string;
  gearbox?: string;
  condition?: string;
  bodyType?: string;
  negotiable?: string;
  equipmentIds?: string;
  sellerType?: string;
  categoryPro?: string;
};

const CATEGORY_KEY: Record<string, string> = {
  VOITURE: "categoryVoiture",
  UTILITAIRE: "categoryUtilitaire",
  POIDS_LOURD: "categoryPoidsLourd",
  DEUX_ROUES: "categoryDeuxRoues",
  AUTRE: "categoryAutre",
};

// Au niveau du module (et non dans le rendu) : un composant ne doit pas lire
// l'horloge pendant son rendu.
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_STEPS = yearOptions(CURRENT_YEAR);

const EQUIPMENT_CATEGORY_ORDER = ["CONFORT", "SECURITE", "MULTIMEDIA", "EXTERIEUR", "ACCESSOIRE"] as const;
const EQUIPMENT_CATEGORY_KEY: Record<string, string> = {
  CONFORT: "equipmentCategoryConfort",
  SECURITE: "equipmentCategorySecurite",
  MULTIMEDIA: "equipmentCategoryMultimedia",
  EXTERIEUR: "equipmentCategoryExterieur",
  ACCESSOIRE: "equipmentCategoryAccessoire",
};

export function SearchFilters({
  brands,
  wilayas,
  equipments = [],
  initialValues,
  compact = false,
}: {
  brands: BrandRow[];
  wilayas: WilayaRow[];
  equipments?: EquipmentRow[];
  initialValues: SearchFilterValues;
  compact?: boolean;
}) {
  const t = useTranslations("Search");
  const tWizard = useTranslations("Wizard");
  const tPro = useTranslations("Pro");
  const locale = useLocale();
  const router = useRouter();
  const numberLocale = locale === "ar" ? "ar-DZ" : "fr-DZ";
  const [values, setValues] = useState<SearchFilterValues>(initialValues);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!compact) return;
    const q = values.q ?? "";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (q.length < 2) { setSuggestions([]); return; }
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    suggestTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(q)}`);
        if (res.ok) setSuggestions(await res.json());
      } catch { /* réseau */ }
    }, 200);
    return () => { if (suggestTimer.current) clearTimeout(suggestTimer.current); };
  }, [values.q, compact]);

  // Lot 130 — marques et modèles proposés selon la catégorie filtrée (les motos n'affichent pas les marques de camions).
  const visibleBrands = filterCatalogueByCategory(brands, values.category as ListingCategory | undefined);
  const selectedBrand = visibleBrands.find((b) => b.id === Number(values.brandId));
  const selectedWilaya = wilayas.find((w) => w.id === Number(values.wilayaId));
  const selectedEquipmentIds = values.equipmentIds ? values.equipmentIds.split(",").map(Number) : [];
  const equipmentsByCategory = new Map<string, EquipmentRow[]>();
  for (const eq of equipments) {
    const list = equipmentsByCategory.get(eq.category) ?? [];
    list.push(eq);
    equipmentsByCategory.set(eq.category, list);
  }

  function toggleEquipment(id: number) {
    const next = selectedEquipmentIds.includes(id)
      ? selectedEquipmentIds.filter((e) => e !== id)
      : [...selectedEquipmentIds, id];
    setValues((prev) => ({ ...prev, equipmentIds: next.length > 0 ? next.join(",") : undefined }));
  }

  function set<K extends keyof SearchFilterValues>(key: K, value: string) {
    setValues((prev) => {
      const next = {
        ...prev,
        [key]: value || undefined,
        ...(key === "brandId" ? { modelId: undefined } : {}),
        ...(key === "wilayaId" ? { communeId: undefined } : {}),
        ...(key === "sellerType" && value !== "pro" ? { categoryPro: undefined } : {}),
      } as SearchFilterValues;
      if (key === "category") {
        // Une marque ou un modèle devenu impossible dans la nouvelle catégorie est retiré du filtre.
        const category = next.category as ListingCategory | undefined;
        const brand = brands.find((b) => b.id === Number(next.brandId));
        if (brand && filterCatalogueByCategory([brand], category).length === 0) {
          next.brandId = undefined;
          next.modelId = undefined;
        } else {
          const model = brand?.models.find((m) => m.id === Number(next.modelId));
          if (model && !modelInCategory(model, category)) next.modelId = undefined;
        }
      }
      return next;
    });
  }

  function navigateWith(filters: Record<string, string | undefined>, aiAssisted: boolean) {
    const query = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) query.set(key, value);
    });
    if (aiAssisted) query.set("via", "ai");
    router.push(`/recherche?${query.toString()}`);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    // Recherche en langage naturel (barre compacte uniquement — les filtres
    // explicites de la recherche avancée ne doivent jamais être réinterprétés).
    if (compact && values.q && values.q.trim().length >= 3) {
      try {
        const res = await fetch("/api/search/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: values.q }),
        });
        if (res.ok) {
          const { filters, source } = await res.json();
          navigateWith(filters, source === "ai");
          return;
        }
      } catch {
        // réseau indisponible — repli sur la recherche texte simple ci-dessous
      }
    }

    navigateWith(values, false);
  }

  return (
    <form onSubmit={submit} className={compact ? "flex flex-col sm:flex-row gap-2" : "space-y-4"}>
      <div className={compact ? "relative flex-1" : "relative"}>
        <input
          type="text"
          value={values.q ?? ""}
          onChange={(e) => { set("q", e.target.value); setShowSuggestions(true); }}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          placeholder={t("queryPlaceholder")}
          aria-label={t("queryPlaceholder")}
          className={
            compact
              ? "w-full rounded-md border border-slate-300 px-4 py-2.5 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              : "w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
          }
        />
        {showSuggestions && suggestions.length > 0 && (
          <ul className="absolute z-20 top-full start-0 end-0 mt-1 rounded-md border border-slate-200 bg-white shadow-md dark:bg-slate-800 dark:border-slate-700">
            {suggestions.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700"
                  onMouseDown={() => { set("q", s); setShowSuggestions(false); }}
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {compact ? (
        <button
          type="submit"
          className="rounded-md bg-emerald-600 px-5 py-2.5 font-medium text-white hover:bg-emerald-700"
        >
          {t("submit")}
        </button>
      ) : (
        <>
          <Field id="filter-category" label={t("category")}>
            <select
              value={values.category ?? ""}
              onChange={(e) => set("category", e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="">{t("any")}</option>
              {Object.entries(CATEGORY_KEY).map(([value, key]) => (
                <option key={value} value={value}>
                  {tWizard(key)}
                </option>
              ))}
            </select>
          </Field>

          <Field id="filter-brand" label={t("brand")}>
            <select
              value={values.brandId ?? ""}
              onChange={(e) => set("brandId", e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="">{t("any")}</option>
              {visibleBrands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>

          {selectedBrand && (
            <Field id="filter-model" label={t("model")}>
              <select
                value={values.modelId ?? ""}
                onChange={(e) => set("modelId", e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
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

          <Field id="filter-wilaya" label={t("wilaya")}>
            <select
              value={values.wilayaId ?? ""}
              onChange={(e) => set("wilayaId", e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="">{t("any")}</option>
              {wilayas.map((w) => (
                <option key={w.id} value={w.id}>
                  {locale === "ar" ? w.nomAr : w.nomFr}
                </option>
              ))}
            </select>
          </Field>

          {selectedWilaya && selectedWilaya.communes.length > 0 && (
            <Field id="filter-commune" label={t("commune")}>
              <select
                value={values.communeId ?? ""}
                onChange={(e) => set("communeId", e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              >
                <option value="">{t("any")}</option>
                {selectedWilaya.communes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {locale === "ar" ? c.nomAr : c.nomFr}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <Field label={t("priceRange")}>
            <div className="flex gap-2">
              <NumberSelect
                value={values.priceMin}
                steps={PRICE_STEPS_DZD}
                emptyLabel={t("min")}
                ariaLabel={`${t("priceRange")} ${t("min")}`}
                format={(n) => n.toLocaleString(numberLocale)}
                onChange={(v) => set("priceMin", v)}
                className="w-1/2"
              />
              <NumberSelect
                value={values.priceMax}
                steps={PRICE_STEPS_DZD}
                emptyLabel={t("max")}
                ariaLabel={`${t("priceRange")} ${t("max")}`}
                format={(n) => n.toLocaleString(numberLocale)}
                onChange={(v) => set("priceMax", v)}
                className="w-1/2"
              />
            </div>
          </Field>

          <Field label={t("yearRange")}>
            <div className="flex gap-2">
              <NumberSelect
                value={values.yearMin}
                steps={YEAR_STEPS}
                order="desc"
                emptyLabel={t("min")}
                ariaLabel={`${t("yearRange")} ${t("min")}`}
                format={(n) => String(n)}
                onChange={(v) => set("yearMin", v)}
                className="w-1/2"
              />
              <NumberSelect
                value={values.yearMax}
                steps={YEAR_STEPS}
                order="desc"
                emptyLabel={t("max")}
                ariaLabel={`${t("yearRange")} ${t("max")}`}
                format={(n) => String(n)}
                onChange={(v) => set("yearMax", v)}
                className="w-1/2"
              />
            </div>
          </Field>

          <Field id="filter-mileage" label={t("mileageMax")}>
            <NumberSelect
              value={values.mileageMax}
              steps={MILEAGE_STEPS_KM}
              emptyLabel={t("any")}
              format={(n) => `${n.toLocaleString(numberLocale)} km`}
              onChange={(v) => set("mileageMax", v)}
              className="w-full"
            />
          </Field>

          <Field id="filter-fuel" label={tWizard("fuelType")}>
            <select
              value={values.fuelType ?? ""}
              onChange={(e) => set("fuelType", e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="">{t("any")}</option>
              <option value="ESSENCE">{tWizard("fuelEssence")}</option>
              <option value="DIESEL">{tWizard("fuelDiesel")}</option>
              <option value="GPL">{tWizard("fuelGpl")}</option>
              <option value="HYBRIDE">{tWizard("fuelHybride")}</option>
              <option value="ELECTRIQUE">{tWizard("fuelElectrique")}</option>
            </select>
          </Field>

          <Field id="filter-gearbox" label={tWizard("gearbox")}>
            <select
              value={values.gearbox ?? ""}
              onChange={(e) => set("gearbox", e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="">{t("any")}</option>
              <option value="MANUELLE">{tWizard("gearboxManuelle")}</option>
              <option value="AUTOMATIQUE">{tWizard("gearboxAutomatique")}</option>
            </select>
          </Field>

          <Field id="filter-condition" label={tWizard("condition")}>
            <select
              value={values.condition ?? ""}
              onChange={(e) => set("condition", e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="">{t("any")}</option>
              <option value="NEUF">{tWizard("conditionNeuf")}</option>
              <option value="OCCASION">{tWizard("conditionOccasion")}</option>
            </select>
          </Field>

          <Field id="filter-body-type" label={tWizard("bodyType")}>
            <select
              value={values.bodyType ?? ""}
              onChange={(e) => set("bodyType", e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="">{t("any")}</option>
              <option value="BERLINE">{tWizard("bodyTypeBerline")}</option>
              <option value="SUV">{tWizard("bodyTypeSuv")}</option>
              <option value="BREAK">{tWizard("bodyTypeBreak")}</option>
              <option value="CITADINE">{tWizard("bodyTypeCitadine")}</option>
              <option value="COUPE">{tWizard("bodyTypeCoupe")}</option>
              <option value="CABRIOLET">{tWizard("bodyTypeCabriolet")}</option>
              <option value="MONOSPACE">{tWizard("bodyTypeMonospace")}</option>
              <option value="PICKUP">{tWizard("bodyTypePickup")}</option>
              <option value="FOURGON">{tWizard("bodyTypeFourgon")}</option>
            </select>
          </Field>

          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={values.negotiable === "1"}
              onChange={(e) => set("negotiable", e.target.checked ? "1" : "")}
            />
            {t("negotiableFilter")}
          </label>

          <Field id="filter-seller-type" label={t("sellerType")}>
            <select
              value={values.sellerType ?? ""}
              onChange={(e) => set("sellerType", e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="">{t("any")}</option>
              <option value="pro">{t("sellerTypePro")}</option>
              <option value="particulier">{t("sellerTypeParticulier")}</option>
            </select>
          </Field>

          {values.sellerType === "pro" && (
            <Field id="filter-category-pro" label={t("categoryProFilterLabel")}>
              <select
                value={values.categoryPro ?? ""}
                onChange={(e) => set("categoryPro", e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              >
                <option value="">{t("any")}</option>
                {PRO_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {tPro(`categoryPro_${cat}`)}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {equipments.length > 0 && (
            <Field label={tWizard("equipmentsTitle")}>
              <div className="space-y-3">
                {EQUIPMENT_CATEGORY_ORDER.filter((c) => equipmentsByCategory.has(c)).map((category) => (
                  <div key={category}>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-1 dark:text-slate-400">
                      {tWizard(EQUIPMENT_CATEGORY_KEY[category])}
                    </p>
                    <div className="space-y-1">
                      {equipmentsByCategory.get(category)!.map((eq) => (
                        <label key={eq.id} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                          <input
                            type="checkbox"
                            checked={selectedEquipmentIds.includes(eq.id)}
                            onChange={() => toggleEquipment(eq.id)}
                          />
                          {locale === "ar" ? eq.nameAr : eq.nameFr}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Field>
          )}

          <button
            type="submit"
            className="w-full rounded-md bg-emerald-600 px-4 py-2.5 font-medium text-white hover:bg-emerald-700"
          >
            {t("submit")}
          </button>
        </>
      )}
    </form>
  );
}

function Field({
  id,
  label,
  children,
}: {
  id?: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      {id ? (
        <label htmlFor={id} className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">
          {label}
        </label>
      ) : (
        <span className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">{label}</span>
      )}
      {id && isValidElement(children)
        ? cloneElement(children as ReactElement<{ id?: string }>, { id })
        : children}
    </div>
  );
}

// Menu de paliers pour un filtre numérique. `id` est injecté par `Field` quand le
// menu est seul dans son champ (lien étiquette ↔ menu).
function NumberSelect({
  id,
  value,
  steps,
  order = "asc",
  emptyLabel,
  ariaLabel,
  format,
  onChange,
  className,
}: {
  id?: string;
  value: string | undefined;
  steps: number[];
  order?: "asc" | "desc";
  emptyLabel: string;
  ariaLabel?: string;
  format: (n: number) => string;
  onChange: (value: string) => void;
  className: string;
}) {
  const options = optionsWithCurrent(steps, value, order);
  return (
    <select
      id={id}
      value={normalizeFilterValue(value)}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
      className={`${className} rounded-md border border-slate-300 px-3 py-2 bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200`}
    >
      <option value="">{emptyLabel}</option>
      {options.map((n) => (
        <option key={n} value={n}>
          {format(n)}
        </option>
      ))}
    </select>
  );
}
