"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

type ModelRow = { id: number; name: string; slug: string; listingCount: number };
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
};

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
        <form onSubmit={handleAddBrand} className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 p-3">
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            {t("brandNameLabel")}
            <input
              type="text"
              value={newBrandName}
              onChange={(e) => setNewBrandName(e.target.value)}
              className="w-56 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
            />
          </label>
          <button
            type="submit"
            disabled={addBrandPending}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
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
    const result = await postJson(`/api/admin/brands/${brand.id}/models`, { name: newModelName });
    setAddModelPending(false);
    if (result.ok) {
      setNewModelName("");
      setAddingModel(false);
      router.refresh();
      return;
    }
    setAddModelError(t(ERROR_KEY[result.error ?? ""] ?? "errorGeneric"));
  }

  const deletable = brand.models.length === 0 && brand.listingCount === 0;

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {editing ? (
          <form onSubmit={handleRename} className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-48 rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-900"
            />
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
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
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              {t("cancelAction")}
            </button>
          </form>
        ) : (
          <div>
            <p className="font-medium text-slate-900">{brand.name}</p>
            <p className="text-xs text-slate-400">
              {brand.slug} · {t("listingCount", { count: brand.listingCount })}
            </p>
          </div>
        )}

        {canEdit && !editing && (
          <div className="flex items-center gap-3 text-xs">
            <button type="button" onClick={() => setEditing(true)} className="text-slate-500 underline hover:text-slate-700">
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
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

      <div className="mt-3 pl-4 border-l border-slate-100 space-y-2">
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
                className="w-48 rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-900"
              />
              <button
                type="submit"
                disabled={addModelPending}
                className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
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
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                {t("cancelAction")}
              </button>
              {addModelError && <p className="w-full text-xs text-red-600">{addModelError}</p>}
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setAddingModel(true)}
              className="text-xs text-slate-500 underline hover:text-slate-700"
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
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRename(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await patchJson(`/api/admin/models/${model.id}`, { name });
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
            className="w-40 rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-900"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {t("saveAction")}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setName(model.name);
              setError(null);
            }}
            className="text-xs text-slate-400 hover:text-slate-600"
          >
            {t("cancelAction")}
          </button>
        </form>
      ) : (
        <div>
          <span className="text-slate-800">{model.name}</span>
          <span className="ml-2 text-xs text-slate-400">
            {model.slug} · {t("listingCount", { count: model.listingCount })}
          </span>
        </div>
      )}

      {canEdit && !editing && (
        <div className="flex items-center gap-3 text-xs">
          <button type="button" onClick={() => setEditing(true)} className="text-slate-500 underline hover:text-slate-700">
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
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </div>
  );
}
