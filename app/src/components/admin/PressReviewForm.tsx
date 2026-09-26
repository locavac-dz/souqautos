"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

type CatalogueBrand = {
  id: number;
  name: string;
  models: { id: number; name: string }[];
};

type ExistingReview = {
  id: string;
  sourceName: string;
  url: string;
  title: string;
  sourcePublishedAt: Date | null;
  noteFr: string;
  noteAr: string;
  brandId: number | null;
  modelId: number | null;
  publishedAt: Date | null;
};

const inputClass = "w-full rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 px-3 py-2";

const ERROR_KEY: Record<string, string> = {
  url_taken: "errorUrlTaken",
  validation: "errorValidation",
};

// Lot 114 — saisie d'une entrée de la revue de presse. Rien n'est téléchargé
// depuis l'adresse saisie : la rédaction recopie le titre et écrit elle-même sa
// phrase dans chaque langue.
export function PressReviewForm({
  review,
  brands,
}: {
  review?: ExistingReview;
  brands: CatalogueBrand[];
}) {
  const t = useTranslations("AdminPressReview");
  const router = useRouter();

  const [sourceName, setSourceName] = useState(review?.sourceName ?? "");
  const [url, setUrl] = useState(review?.url ?? "");
  const [title, setTitle] = useState(review?.title ?? "");
  const [sourcePublishedAt, setSourcePublishedAt] = useState(
    review?.sourcePublishedAt ? review.sourcePublishedAt.toISOString().slice(0, 10) : ""
  );
  const [noteFr, setNoteFr] = useState(review?.noteFr ?? "");
  const [noteAr, setNoteAr] = useState(review?.noteAr ?? "");
  const [brandId, setBrandId] = useState(review?.brandId ? String(review.brandId) : "");
  const [modelId, setModelId] = useState(review?.modelId ? String(review.modelId) : "");
  const [published, setPublished] = useState(Boolean(review?.publishedAt));

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const models = useMemo(() => brands.find((b) => String(b.id) === brandId)?.models ?? [], [brands, brandId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const payload = {
      sourceName,
      url,
      title,
      sourcePublishedAt: sourcePublishedAt || undefined,
      noteFr,
      noteAr,
      brandId: brandId ? Number(brandId) : undefined,
      modelId: modelId ? Number(modelId) : undefined,
      published,
    };

    const res = await fetch(review ? `/api/admin/press-reviews/${review.id}` : "/api/admin/press-reviews", {
      method: review ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setPending(false);
    if (res.ok) {
      router.push("/admin/revue-de-presse");
      router.refresh();
      return;
    }
    const data = await res.json().catch(() => null);
    setError(t(ERROR_KEY[data?.error] ?? "errorValidation"));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      <fieldset className="space-y-4 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
        <legend className="px-1 text-sm font-medium text-slate-900 dark:text-slate-100">{t("sectionSource")}</legend>
        <div>
          <label htmlFor="prUrl" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {t("urlLabel")}
          </label>
          <input
            id="prUrl"
            type="url"
            inputMode="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            maxLength={500}
            placeholder="https://…"
            className={inputClass}
          />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t("urlHelp")}</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="prSource" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t("sourceNameLabel")}
            </label>
            <input
              id="prSource"
              type="text"
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
              maxLength={80}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="prDate" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t("sourceDateLabel")}
            </label>
            <input
              id="prDate"
              type="date"
              value={sourcePublishedAt}
              onChange={(e) => setSourcePublishedAt(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
        <div>
          <label htmlFor="prTitle" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {t("titleLabel")}
          </label>
          <input
            id="prTitle"
            type="text"
            dir="auto"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t("titleHelp")}</p>
        </div>
      </fieldset>

      <fieldset className="space-y-4 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
        <legend className="px-1 text-sm font-medium text-slate-900 dark:text-slate-100">{t("sectionVehicle")}</legend>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="prBrand" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t("brandLabel")}
            </label>
            <select
              id="prBrand"
              value={brandId}
              onChange={(e) => {
                setBrandId(e.target.value);
                setModelId("");
              }}
              className={`${inputClass} bg-white dark:bg-slate-800 dark:text-slate-200`}
            >
              <option value="">—</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="prModel" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t("modelLabel")}
            </label>
            <select
              id="prModel"
              value={modelId}
              disabled={!brandId}
              onChange={(e) => setModelId(e.target.value)}
              className={`${inputClass} bg-white dark:bg-slate-800 dark:text-slate-200 disabled:bg-slate-50 dark:disabled:bg-slate-700`}
            >
              <option value="">—</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 -mt-2">{t("vehicleHelp")}</p>
      </fieldset>

      <fieldset className="space-y-4 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
        <legend className="px-1 text-sm font-medium text-slate-900 dark:text-slate-100">{t("sectionNote")}</legend>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="prNoteFr" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t("noteFrLabel")}
            </label>
            <textarea
              id="prNoteFr"
              value={noteFr}
              onChange={(e) => setNoteFr(e.target.value)}
              maxLength={300}
              rows={3}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="prNoteAr" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t("noteArLabel")}
            </label>
            <textarea
              id="prNoteAr"
              dir="rtl"
              value={noteAr}
              onChange={(e) => setNoteAr(e.target.value)}
              maxLength={300}
              rows={3}
              className={inputClass}
            />
          </div>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 -mt-2">{t("noteHelp")}</p>
      </fieldset>

      <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
        <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
        {t("publishedLabel")}
      </label>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-slate-900 dark:bg-slate-100 px-4 py-2 text-sm font-medium text-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-slate-300 disabled:opacity-50"
      >
        {pending ? t("saving") : t("save")}
      </button>
    </form>
  );
}
