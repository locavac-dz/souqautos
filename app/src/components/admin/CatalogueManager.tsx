"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { CATALOGUE_CATEGORIES, type CatalogueCategory } from "@/lib/vehicle-catalogue";

type ModelRow = { id: number; name: string; slug: string; categories: string[]; listingCount: number };
type BrandRow = { id: number; name: string; slug: string; listingCount: number; models: ModelRow[] };

const ERROR_KEY: Record<string, string> = {
  name_required: "errorNameRequired",
  name_too_long: "errorNameTooLong",
  slug_taken: "errorSlugTaken",
  has_models: "errorHasModels",
  has_listings: "errorHasListings",
  has_guides: "errorHasGuides",
  forbidden: "errorGeneric",
  not_found: "errorGeneric",
  validation: "errorGeneric",
  invalid_categories: "errorCategories",
};

const CATEGORY_LABEL: Record<CatalogueCategory, string> = {
  VOITURE: "categoryVOITURE",
  UTILITAIRE: "categoryUTILITAIRE",
  POIDS_LOURD: "categoryPOIDS_LOURD",
  DEUX_ROUES: "categoryDEUX_ROUES",
};

// Lot 130 — cases à cocher des catégories d'un modèle (au moins une).
function CategoryChecks({ value, onChange, idPrefix }: { value: CatalogueCategory[]; onChange: (next: CatalogueCategory[]) => void; idPrefix: string }) {
  const t = useTranslations("AdminCatalogue");
  return (
    <fieldset className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <legend className="sr-only">{t("categoriesLabel")}</legend>
      {CATALOGUE_CATEGORIES.map((category) => (
        <label key={category} htmlFor={`${idPrefix}-${category}`} className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
          <input
            id={`${idPrefix}-${category}`}
            type="checkbox"
            checked={value.includes(category)}
            onChange={(e) => onChange(CATALOGUE_CATEGORIES.filter((c) => (c === category ? e.target.checked : value.includes(c))))}
          />
          {t(CATEGORY_LABEL[category])}
        </label>
      ))}
    </fieldset>
  );
}

function asCategories(values: string[]): CatalogueCategory[] {
  return CATALOGUE_CATEGORIES.filter((c) => values.includes(c));
}

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, error: data?.error as string | undefined };
}

async function patchJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, error: data?.error as string | undefined };
}

async function deleteJson(url: string) {
  const res = await fetch(url, { method: "DELETE" });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, error: data?.error as string | undefined };
}

export function CatalogueManager({ brands, canEdit }: { brands: BrandRow[]; canEdit: boolean }) {
  const t = useTranslations("AdminCatalogue");
  const router = useRouter();

  const [newBrandName, setNewBrandName] = useState("");
  const [addBrandError, setAddBrandError] = useState<string | null>(null);
  const [addBrandPending, setAddBrandPending] = useState(false);

  async function handleAddBrand(e: React.FormEvent) {
    e.preventDefault();
    setAddBrandPending(true);
    setAddBrandError(null);
    const result = await postJson("/api/admin/brands", { name: newBrandName });
    setAddBrandPending(false);
    if (result.ok) {
      setNewBrandName("");
      router.refresh();
      return;
    }
    setAddBrandError(t(ERROR_KEY[result.error ?? ""] ?? "errorGeneric"));
  }

  return (
    <div className="space-y-6">
      {canEdit && (
        <form onSubmit={handleAddBrand} className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
          <label className="flex flex-col gap-1 text-xs text-slate-500 dark:text-slate-400">
            {t("brandNameLabel")}
            <input
              type="text"
              value={newBrandName}
              onChange={(e) => setNewBrandName(e.target.value)}
              className="w-56 rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 px-2 py-1.5 text-sm text-slate-900"
            />
          </label>
          <button
            type="submit"
            disabled={addBrandPending}
            className="rounded-md bg-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {t("addBrandAction")}
          </button>
          {addBrandError && <p className="w-full text-xs text-red-600">{addBrandError}</p>}
        </form>
      )}

      <div className="space-y-4">
        {brands.map((brand) => (
          <BrandCard key={brand.id} brand={brand} canEdit={canEdit} />
        ))}
      </div>
    </div>
  );
}

function BrandCard({ brand, canEdit }: { brand: BrandRow; canEdit: boolean }) {
  const t = useTranslations("AdminCatalogue");
  const router = useRouter();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(brand.name);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [addingModel, setAddingModel] = useState(false);
  const [newModelName, setNewModelName] = useState("");
  const [newModelCategories, setNewModelCategories] = useState<CatalogueCategory[]>(["VOITURE"]);
  const [addModelError, setAddModelError] = useState<string | null>(null);
  const [addModelPending, setAddModelPending] = useState(false);

  async function handleRename(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await patchJson(`/api/admin/brands/${brand.id}`, { name });
    setPending(false);
    if (result.ok) {
      setEditing(false);
      router.refresh();
      return;
    }
    setError(t(ERROR_KEY[result.error ?? ""] ?? "errorGeneric"));
  }

  async function handleDelete() {
    setPending(true);
    setError(null);
    const result = await deleteJson(`/api/admin/brands/${brand.id}`);
    setPending(false);
    if (result.ok) {
      router.refresh();
      return;
    }
    setError(t(ERROR_KEY[result.error ?? ""] ?? "errorGeneric"));
  }

  async function handleAddModel(e: React.FormEvent) {
    e.preventDefault();
    setAddModelPending(true);
    setAddModelError(null);
    const result = await postJson(`/api/admin/brands/${brand.id}/models`, { name: newModelName, categories: newModelCategories });
    setAddModelPending(false);
    if (result.ok) {
      setNewModelName("");
      setNewModelCategories(["VOITURE"]);
      setAddingModel(false);
      router.refresh();
      return;
    }
    setAddModelError(t(ERROR_KEY[result.error ?? ""] ?? "errorGeneric"));
  }

  const deletable = brand.models.length === 0 && brand.listingCount === 0;

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {editing ? (
          <form onSubmit={handleRename} className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-48 rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 px-2 py-1 text-sm text-slate-900"
            />
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {t("saveAction")}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setName(brand.name);
                setError(null);
              }}
              className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              {t("cancelAction")}
            </button>
          </form>
        ) : (
          <div>
            <p className="font-medium text-slate-900 dark:text-slate-100">{brand.name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {brand.slug} · {t("listingCount", { count: brand.listingCount })}
            </p>
          </div>
        )}

        {canEdit && !editing && (
          <div className="flex items-center gap-3 text-xs">
            <button type="button" onClick={() => setEditing(true)} className="text-slate-500 dark:text-slate-400 underline hover:text-slate-700 dark:hover:text-slate-300">
              {t("editAction")}
            </button>
            <button
              type="button"
              disabled={!deletable || pending}
              onClick={handleDelete}
              title={!deletable ? t("errorHasModels") : undefined}
              className="text-red-600 hover:underline disabled:text-slate-300 disabled:no-underline"
            >
              {t("deleteAction")}
            </button>
          </div>
        )}
      </div>
      {error && <p role="alert" className="mt-1 text-xs text-red-600">{error}</p>}

      <div className="mt-3 pl-4 border-l border-slate-100 dark:border-slate-700 space-y-2">
        {brand.models.map((model) => (
          <ModelRowItem key={model.id} model={model} canEdit={canEdit} />
        ))}

        {canEdit &&
          (addingModel ? (
            <form onSubmit={handleAddModel} className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={newModelName}
                onChange={(e) => setNewModelName(e.target.value)}
                placeholder={t("modelNameLabel")}
                className="w-48 rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 px-2 py-1 text-sm text-slate-900"
              />
              <CategoryChecks value={newModelCategories} onChange={setNewModelCategories} idPrefix={`new-model-${brand.id}`} />
              <button
                type="submit"
                disabled={addModelPending || newModelCategories.length === 0}
                className="rounded-md bg-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {t("saveAction")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddingModel(false);
                  setNewModelName("");
                  setAddModelError(null);
                }}
                className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                {t("cancelAction")}
              </button>
              {addModelError && <p className="w-full text-xs text-red-600">{addModelError}</p>}
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setAddingModel(true)}
              className="text-xs text-slate-500 dark:text-slate-400 underline hover:text-slate-700 dark:hover:text-slate-300"
            >
              {t("addModelAction")}
            </button>
          ))}
      </div>
    </div>
  );
}

function ModelRowItem({ model, canEdit }: { model: ModelRow; canEdit: boolean }) {
  const t = useTranslations("AdminCatalogue");
  const router = useRouter();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(model.name);
  const [categories, setCategories] = useState<CatalogueCategory[]>(asCategories(model.categories));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRename(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await patchJson(`/api/admin/models/${model.id}`, { name, categories });
    setPending(false);
    if (result.ok) {
      setEditing(false);
      router.refresh();
      return;
    }
    setError(t(ERROR_KEY[result.error ?? ""] ?? "errorGeneric"));
  }

  async function handleDelete() {
    setPending(true);
    setError(null);
    const result = await deleteJson(`/api/admin/models/${model.id}`);
    setPending(false);
    if (result.ok) {
      router.refresh();
      return;
    }
    setError(t(ERROR_KEY[result.error ?? ""] ?? "errorGeneric"));
  }

  const deletable = model.listingCount === 0;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
      {editing ? (
        <form onSubmit={handleRename} className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-40 rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 px-2 py-1 text-sm text-slate-900"
          />
          <CategoryChecks value={categories} onChange={setCategories} idPrefix={`model-${model.id}`} />
          <button
            type="submit"
            disabled={pending || categories.length === 0}
            className="rounded-md bg-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {t("saveAction")}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setName(model.name);
              setCategories(asCategories(model.categories));
              setError(null);
            }}
            className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            {t("cancelAction")}
          </button>
        </form>
      ) : (
        <div>
          <span className="text-slate-800 dark:text-slate-100">{model.name}</span>
          <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
            {model.slug} · {asCategories(model.categories).map((c) => t(CATEGORY_LABEL[c])).join(", ")} · {t("listingCount", { count: model.listingCount })}
          </span>
        </div>
      )}

      {canEdit && !editing && (
        <div className="flex items-center gap-3 text-xs">
          <button type="button" onClick={() => setEditing(true)} className="text-slate-500 dark:text-slate-400 underline hover:text-slate-700 dark:hover:text-slate-300">
            {t("editAction")}
          </button>
          <button
            type="button"
            disabled={!deletable || pending}
            onClick={handleDelete}
            title={!deletable ? t("errorHasListings") : undefined}
            className="text-red-600 hover:underline disabled:text-slate-300 disabled:no-underline"
          >
            {t("deleteAction")}
          </button>
        </div>
      )}
      {error && <p role="alert" className="w-full text-xs text-red-600">{error}</p>}
    </div>
  );
}
