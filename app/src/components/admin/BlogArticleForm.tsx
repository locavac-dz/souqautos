"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

type ArticleKind = "ARTICLE" | "ESSAI" | "GUIDE";

type ExistingGuide = {
  brandId: number;
  modelId: number;
  generationId: number | null;
  checklistFr: string;
  checklistAr: string;
  adviceFr: string;
  adviceAr: string;
};

type ExistingRoadTest = {
  brandId: number | null;
  modelId: number | null;
  generationId: number | null;
  rating: number;
  prosFr: string;
  prosAr: string;
  consFr: string;
  consAr: string;
  verdictFr: string;
  verdictAr: string;
  testedVersion: string | null;
  testedAt: Date | null;
};

type ExistingArticle = {
  id: string;
  titleFr: string;
  titleAr: string;
  excerptFr: string;
  excerptAr: string;
  contentFr: string;
  contentAr: string;
  publishedAt: Date | null;
  coverImageUrl?: string | null;
  sourceName?: string | null;
  sourceUrl?: string | null;
  roadTest?: ExistingRoadTest | null;
  guide?: ExistingGuide | null;
};

const COVER_ERROR_KEY: Record<string, string> = {
  photo_too_large: "coverErrorTooLarge",
  photo_invalid_type: "coverErrorInvalidType",
};

type CatalogueBrand = {
  id: number;
  name: string;
  models: { id: number; name: string; generations: { id: number; name: string }[] }[];
};

type PublicationMode = "draft" | "now" | "scheduled";

// État de l'article à l'ouverture du formulaire, calculé côté serveur (un
// composant client ne doit pas lire l'horloge pendant son rendu).
type InitialStatus = "draft" | "scheduled" | "published";

const RATING_OPTIONS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

// <input type="datetime-local"> attend l'heure locale au format « AAAA-MM-JJTHH:mm ».
function toDatetimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const inputClass = "w-full rounded-md border border-slate-300 px-3 py-2";

export function BlogArticleForm({
  kind = "ARTICLE",
  article,
  status = "draft",
  brands = [],
  defaultModel,
}: {
  kind?: ArticleKind;
  article?: ExistingArticle;
  status?: InitialStatus;
  brands?: CatalogueBrand[];
  // Lot 127 — modèle proposé d'emblée à la création d'un guide (lien « Rédiger un guide »).
  defaultModel?: { brandId: number; modelId: number };
}) {
  const t = useTranslations("AdminBlog");
  const tRt = useTranslations("AdminRoadTest");
  const tG = useTranslations("AdminGuide");
  const router = useRouter();
  const isEssai = kind === "ESSAI";
  const isGuide = kind === "GUIDE";

  const [titleFr, setTitleFr] = useState(article?.titleFr ?? "");
  const [titleAr, setTitleAr] = useState(article?.titleAr ?? "");
  const [excerptFr, setExcerptFr] = useState(article?.excerptFr ?? "");
  const [excerptAr, setExcerptAr] = useState(article?.excerptAr ?? "");
  const [contentFr, setContentFr] = useState(article?.contentFr ?? "");
  const [contentAr, setContentAr] = useState(article?.contentAr ?? "");

  const initialPublishedAt = article?.publishedAt ?? null;
  const initialMode: PublicationMode = status === "published" ? "now" : status === "scheduled" ? "scheduled" : "draft";
  const [mode, setMode] = useState<PublicationMode>(initialMode);
  const [scheduledAt, setScheduledAt] = useState(
    initialPublishedAt && initialMode === "scheduled" ? toDatetimeLocal(initialPublishedAt) : ""
  );

  const rt = article?.roadTest;
  const gd = article?.guide;
  const [brandId, setBrandId] = useState(rt?.brandId ? String(rt.brandId) : gd?.brandId ? String(gd.brandId) : defaultModel ? String(defaultModel.brandId) : "");
  const [modelId, setModelId] = useState(rt?.modelId ? String(rt.modelId) : gd?.modelId ? String(gd.modelId) : defaultModel ? String(defaultModel.modelId) : "");
  const [generationId, setGenerationId] = useState(rt?.generationId ? String(rt.generationId) : gd?.generationId ? String(gd.generationId) : "");
  const [checklistFr, setChecklistFr] = useState(gd?.checklistFr ?? "");
  const [checklistAr, setChecklistAr] = useState(gd?.checklistAr ?? "");
  const [adviceFr, setAdviceFr] = useState(gd?.adviceFr ?? "");
  const [adviceAr, setAdviceAr] = useState(gd?.adviceAr ?? "");
  const [rating, setRating] = useState(rt ? String(rt.rating) : "");
  const [prosFr, setProsFr] = useState(rt?.prosFr ?? "");
  const [prosAr, setProsAr] = useState(rt?.prosAr ?? "");
  const [consFr, setConsFr] = useState(rt?.consFr ?? "");
  const [consAr, setConsAr] = useState(rt?.consAr ?? "");
  const [verdictFr, setVerdictFr] = useState(rt?.verdictFr ?? "");
  const [verdictAr, setVerdictAr] = useState(rt?.verdictAr ?? "");
  const [testedVersion, setTestedVersion] = useState(rt?.testedVersion ?? "");
  const [testedAt, setTestedAt] = useState(rt?.testedAt ? rt.testedAt.toISOString().slice(0, 10) : "");

  const [sourceName, setSourceName] = useState(article?.sourceName ?? "");
  const [sourceUrl, setSourceUrl] = useState(article?.sourceUrl ?? "");

  const [coverUrl, setCoverUrl] = useState<string | null>(article?.coverImageUrl ?? null);
  const [coverPending, setCoverPending] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // L'image est envoyée tout de suite (recadrée 16:9 côté serveur) ; son adresse
  // n'est rattachée à l'article qu'à l'enregistrement du formulaire.
  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setCoverPending(true);
    setCoverError(null);
    const formData = new FormData();
    formData.append("cover", file);

    const res = await fetch("/api/admin/blog/cover", { method: "POST", body: formData });
    setCoverPending(false);
    if (res.ok) {
      const data = await res.json();
      setCoverUrl(data.coverImageUrl);
      return;
    }
    const data = await res.json().catch(() => null);
    setCoverError(tRt(COVER_ERROR_KEY[data?.error] ?? "coverErrorGeneric"));
  }

  const models = useMemo(
    () => brands.find((b) => String(b.id) === brandId)?.models ?? [],
    [brands, brandId]
  );
  const generations = useMemo(
    () => models.find((m) => String(m.id) === modelId)?.generations ?? [],
    [models, modelId]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const publication =
      mode === "scheduled"
        ? scheduledAt
          ? { mode, at: new Date(scheduledAt).toISOString() }
          : null
        : { mode };
    if (!publication) {
      setPending(false);
      setError(t("scheduledAtRequired"));
      return;
    }

    if (isGuide && !modelId) {
      setPending(false);
      setError(tG("modelRequired"));
      return;
    }

    const payload = {
      kind,
      titleFr,
      titleAr,
      excerptFr,
      excerptAr,
      contentFr,
      contentAr,
      publication,
      // Lot 115 — source d'un article du magazine (jamais pour un essai).
      ...(kind === "ARTICLE" && { sourceName: sourceName.trim() || null, sourceUrl: sourceUrl.trim() || null }),
      ...(isGuide && {
        coverImageUrl: coverUrl,
        guide: {
          modelId: Number(modelId),
          generationId: generationId ? Number(generationId) : undefined,
          checklistFr,
          checklistAr,
          adviceFr,
          adviceAr,
        },
      }),
      ...(isEssai && {
        coverImageUrl: coverUrl,
        roadTest: {
          brandId: brandId ? Number(brandId) : undefined,
          modelId: modelId ? Number(modelId) : undefined,
          generationId: generationId ? Number(generationId) : undefined,
          rating: Number(rating),
          prosFr,
          prosAr,
          consFr,
          consAr,
          verdictFr,
          verdictAr,
          testedVersion: testedVersion.trim() || undefined,
          testedAt: testedAt || undefined,
        },
      }),
    };

    const res = article
      ? await fetch(`/api/admin/blog/${article.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await fetch("/api/admin/blog", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

    setPending(false);
    if (res.ok) {
      router.push(isEssai ? "/admin/essais" : isGuide ? "/admin/guides" : "/admin/mag");
      router.refresh();
      return;
    }
    setError(isEssai ? tRt("errorGeneric") : isGuide ? tG("errorGeneric") : t("errorGeneric"));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="titleFr" className="block text-sm font-medium text-slate-700 mb-1">
            {t("titleFrLabel")}
          </label>
          <input
            id="titleFr"
            type="text"
            value={titleFr}
            onChange={(e) => setTitleFr(e.target.value)}
            maxLength={150}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="titleAr" className="block text-sm font-medium text-slate-700 mb-1">
            {t("titleArLabel")}
          </label>
          <input
            id="titleAr"
            type="text"
            dir="rtl"
            value={titleAr}
            onChange={(e) => setTitleAr(e.target.value)}
            maxLength={150}
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="excerptFr" className="block text-sm font-medium text-slate-700 mb-1">
            {t("excerptFrLabel")}
          </label>
          <textarea
            id="excerptFr"
            value={excerptFr}
            onChange={(e) => setExcerptFr(e.target.value)}
            maxLength={300}
            rows={2}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="excerptAr" className="block text-sm font-medium text-slate-700 mb-1">
            {t("excerptArLabel")}
          </label>
          <textarea
            id="excerptAr"
            dir="rtl"
            value={excerptAr}
            onChange={(e) => setExcerptAr(e.target.value)}
            maxLength={300}
            rows={2}
            className={inputClass}
          />
        </div>
      </div>

      {(isEssai || isGuide) && (
        <fieldset className="space-y-2 rounded-lg border border-slate-200 p-4">
          <legend className="px-1 text-sm font-medium text-slate-900">{tRt("coverTitle")}</legend>
          <div className="flex items-center gap-4">
            {coverUrl ? (
              <div className="relative aspect-video w-40 shrink-0">
                <Image src={coverUrl} alt="" fill sizes="160px" className="rounded-md border border-slate-200 object-cover" />
              </div>
            ) : (
              <div className="aspect-video w-40 shrink-0 rounded-md border border-slate-200 bg-slate-100" />
            )}
            <div className="flex flex-col items-start gap-1">
              <label className="cursor-pointer text-sm text-slate-700 underline hover:text-slate-900">
                {coverPending ? tRt("coverUploading") : coverUrl ? tRt("coverReplace") : tRt("coverChange")}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleCoverUpload}
                  disabled={coverPending}
                  className="hidden"
                />
              </label>
              {coverUrl && (
                <button
                  type="button"
                  onClick={() => setCoverUrl(null)}
                  disabled={coverPending}
                  className="text-xs text-red-600 hover:underline disabled:opacity-50"
                >
                  {tRt("coverRemove")}
                </button>
              )}
            </div>
          </div>
          <p className="text-xs text-slate-500">{tRt("coverHelp")}</p>
          {coverError && <p className="text-sm text-red-600">{coverError}</p>}
        </fieldset>
      )}

      {isGuide && (
        <fieldset className="space-y-4 rounded-lg border border-slate-200 p-4">
          <legend className="px-1 text-sm font-medium text-slate-900">{tG("sectionModel")}</legend>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="gBrand" className="block text-sm font-medium text-slate-700 mb-1">
                {tG("brandLabel")}
              </label>
              <select
                id="gBrand"
                value={brandId}
                onChange={(e) => {
                  setBrandId(e.target.value);
                  setModelId("");
                  setGenerationId("");
                }}
                className={`${inputClass} bg-white`}
              >
                <option value="">{tG("chooseOption")}</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="gModel" className="block text-sm font-medium text-slate-700 mb-1">
                {tG("modelLabel")}
              </label>
              <select
                id="gModel"
                value={modelId}
                disabled={!brandId}
                onChange={(e) => {
                  setModelId(e.target.value);
                  setGenerationId("");
                }}
                className={`${inputClass} bg-white disabled:bg-slate-50`}
              >
                <option value="">{tG("chooseOption")}</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="gGeneration" className="block text-sm font-medium text-slate-700 mb-1">
                {tG("generationLabel")}
              </label>
              <select
                id="gGeneration"
                value={generationId}
                disabled={!modelId || generations.length === 0}
                onChange={(e) => setGenerationId(e.target.value)}
                className={`${inputClass} bg-white disabled:bg-slate-50`}
              >
                <option value="">{tG("noneOption")}</option>
                {generations.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-xs text-slate-500 -mt-2">{tG("modelHelp")}</p>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="gChecklistFr" className="block text-sm font-medium text-slate-700 mb-1">
                {tG("checklistFrLabel")}
              </label>
              <textarea id="gChecklistFr" value={checklistFr} onChange={(e) => setChecklistFr(e.target.value)} rows={6} className={inputClass} />
            </div>
            <div>
              <label htmlFor="gChecklistAr" className="block text-sm font-medium text-slate-700 mb-1">
                {tG("checklistArLabel")}
              </label>
              <textarea id="gChecklistAr" dir="rtl" value={checklistAr} onChange={(e) => setChecklistAr(e.target.value)} rows={6} className={inputClass} />
            </div>
          </div>
          <p className="text-xs text-slate-500 -mt-2">{tG("checklistHelp")}</p>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="gAdviceFr" className="block text-sm font-medium text-slate-700 mb-1">
                {tG("adviceFrLabel")}
              </label>
              <textarea id="gAdviceFr" value={adviceFr} onChange={(e) => setAdviceFr(e.target.value)} maxLength={400} rows={3} className={inputClass} />
            </div>
            <div>
              <label htmlFor="gAdviceAr" className="block text-sm font-medium text-slate-700 mb-1">
                {tG("adviceArLabel")}
              </label>
              <textarea id="gAdviceAr" dir="rtl" value={adviceAr} onChange={(e) => setAdviceAr(e.target.value)} maxLength={400} rows={3} className={inputClass} />
            </div>
          </div>
          <p className="text-xs text-slate-500 -mt-2">{tG("adviceHelp")}</p>
        </fieldset>
      )}

      {isEssai && (
        <fieldset className="space-y-4 rounded-lg border border-slate-200 p-4">
          <legend className="px-1 text-sm font-medium text-slate-900">{tRt("sectionVehicle")}</legend>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="rtBrand" className="block text-sm font-medium text-slate-700 mb-1">
                {tRt("brandLabel")}
              </label>
              <select
                id="rtBrand"
                value={brandId}
                onChange={(e) => {
                  setBrandId(e.target.value);
                  setModelId("");
                  setGenerationId("");
                }}
                className={`${inputClass} bg-white`}
              >
                <option value="">{tRt("noneOption")}</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="rtModel" className="block text-sm font-medium text-slate-700 mb-1">
                {tRt("modelLabel")}
              </label>
              <select
                id="rtModel"
                value={modelId}
                disabled={!brandId}
                onChange={(e) => {
                  setModelId(e.target.value);
                  setGenerationId("");
                }}
                className={`${inputClass} bg-white disabled:bg-slate-50`}
              >
                <option value="">{tRt("noneOption")}</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="rtGeneration" className="block text-sm font-medium text-slate-700 mb-1">
                {tRt("generationLabel")}
              </label>
              <select
                id="rtGeneration"
                value={generationId}
                disabled={!modelId || generations.length === 0}
                onChange={(e) => setGenerationId(e.target.value)}
                className={`${inputClass} bg-white disabled:bg-slate-50`}
              >
                <option value="">{tRt("noneOption")}</option>
                {generations.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-xs text-slate-500 -mt-2">{tRt("vehicleHelp")}</p>

          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="rtRating" className="block text-sm font-medium text-slate-700 mb-1">
                {tRt("ratingLabel")}
              </label>
              <select
                id="rtRating"
                value={rating}
                onChange={(e) => setRating(e.target.value)}
                className={`${inputClass} bg-white`}
              >
                <option value="" disabled>
                  —
                </option>
                {RATING_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r} / 5
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="rtVersion" className="block text-sm font-medium text-slate-700 mb-1">
                {tRt("testedVersionLabel")}
              </label>
              <input
                id="rtVersion"
                type="text"
                value={testedVersion}
                onChange={(e) => setTestedVersion(e.target.value)}
                maxLength={120}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="rtDate" className="block text-sm font-medium text-slate-700 mb-1">
                {tRt("testedAtLabel")}
              </label>
              <input
                id="rtDate"
                type="date"
                value={testedAt}
                onChange={(e) => setTestedAt(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="rtProsFr" className="block text-sm font-medium text-slate-700 mb-1">
                {tRt("prosFrLabel")}
              </label>
              <textarea id="rtProsFr" value={prosFr} onChange={(e) => setProsFr(e.target.value)} rows={4} className={inputClass} />
            </div>
            <div>
              <label htmlFor="rtProsAr" className="block text-sm font-medium text-slate-700 mb-1">
                {tRt("prosArLabel")}
              </label>
              <textarea id="rtProsAr" dir="rtl" value={prosAr} onChange={(e) => setProsAr(e.target.value)} rows={4} className={inputClass} />
            </div>
            <div>
              <label htmlFor="rtConsFr" className="block text-sm font-medium text-slate-700 mb-1">
                {tRt("consFrLabel")}
              </label>
              <textarea id="rtConsFr" value={consFr} onChange={(e) => setConsFr(e.target.value)} rows={4} className={inputClass} />
            </div>
            <div>
              <label htmlFor="rtConsAr" className="block text-sm font-medium text-slate-700 mb-1">
                {tRt("consArLabel")}
              </label>
              <textarea id="rtConsAr" dir="rtl" value={consAr} onChange={(e) => setConsAr(e.target.value)} rows={4} className={inputClass} />
            </div>
          </div>
          <p className="text-xs text-slate-500 -mt-2">{tRt("listHelp")}</p>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="rtVerdictFr" className="block text-sm font-medium text-slate-700 mb-1">
                {tRt("verdictFrLabel")}
              </label>
              <textarea
                id="rtVerdictFr"
                value={verdictFr}
                onChange={(e) => setVerdictFr(e.target.value)}
                maxLength={400}
                rows={3}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="rtVerdictAr" className="block text-sm font-medium text-slate-700 mb-1">
                {tRt("verdictArLabel")}
              </label>
              <textarea
                id="rtVerdictAr"
                dir="rtl"
                value={verdictAr}
                onChange={(e) => setVerdictAr(e.target.value)}
                maxLength={400}
                rows={3}
                className={inputClass}
              />
            </div>
          </div>
        </fieldset>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="contentFr" className="block text-sm font-medium text-slate-700 mb-1">
            {t("contentFrLabel")}
          </label>
          <textarea
            id="contentFr"
            value={contentFr}
            onChange={(e) => setContentFr(e.target.value)}
            maxLength={20000}
            rows={16}
            className={`${inputClass} font-mono text-sm`}
          />
        </div>
        <div>
          <label htmlFor="contentAr" className="block text-sm font-medium text-slate-700 mb-1">
            {t("contentArLabel")}
          </label>
          <textarea
            id="contentAr"
            dir="rtl"
            value={contentAr}
            onChange={(e) => setContentAr(e.target.value)}
            maxLength={20000}
            rows={16}
            className={`${inputClass} font-mono text-sm`}
          />
        </div>
      </div>
      <p className="text-xs text-slate-500 -mt-4">{isEssai || isGuide ? tRt("markdownHelp") : t("contentHelp")}</p>

      {kind === "ARTICLE" && (
        <fieldset className="space-y-3 rounded-lg border border-slate-200 p-4">
          <legend className="px-1 text-sm font-medium text-slate-900">{t("sourceSection")}</legend>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="sourceName" className="block text-sm font-medium text-slate-700 mb-1">
                {t("sourceNameLabel")}
              </label>
              <input
                id="sourceName"
                type="text"
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
                maxLength={120}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="sourceUrl" className="block text-sm font-medium text-slate-700 mb-1">
                {t("sourceUrlLabel")}
              </label>
              <input
                id="sourceUrl"
                type="url"
                inputMode="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                maxLength={500}
                placeholder="https://…"
                className={inputClass}
              />
            </div>
          </div>
          <p className="text-xs text-slate-500">{t("sourceHelp")}</p>
        </fieldset>
      )}

      <fieldset className="space-y-2 rounded-lg border border-slate-200 p-4">
        <legend className="px-1 text-sm font-medium text-slate-900">{t("publicationLabel")}</legend>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="radio" name="publication" checked={mode === "draft"} onChange={() => setMode("draft")} />
          {t("publicationDraft")}
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="radio" name="publication" checked={mode === "now"} onChange={() => setMode("now")} />
          {initialMode === "now" ? t("publicationPublished") : t("publicationNow")}
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="radio" name="publication" checked={mode === "scheduled"} onChange={() => setMode("scheduled")} />
          {t("publicationScheduled")}
          <input
            type="datetime-local"
            value={scheduledAt}
            disabled={mode !== "scheduled"}
            onChange={(e) => setScheduledAt(e.target.value)}
            aria-label={t("publicationScheduled")}
            className="rounded-md border border-slate-300 px-2 py-1 text-sm disabled:bg-slate-50 disabled:text-slate-400"
          />
        </label>
        <p className="text-xs text-slate-500">{t("publicationHelp")}</p>
      </fieldset>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {pending ? t("saving") : t("save")}
      </button>
    </form>
  );
}
