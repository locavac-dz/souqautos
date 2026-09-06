"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

type ExistingArticle = {
  id: string;
  titleFr: string;
  titleAr: string;
  excerptFr: string;
  excerptAr: string;
  contentFr: string;
  contentAr: string;
  publishedAt: Date | null;
};

export function BlogArticleForm({ article }: { article?: ExistingArticle }) {
  const t = useTranslations("AdminBlog");
  const router = useRouter();

  const [titleFr, setTitleFr] = useState(article?.titleFr ?? "");
  const [titleAr, setTitleAr] = useState(article?.titleAr ?? "");
  const [excerptFr, setExcerptFr] = useState(article?.excerptFr ?? "");
  const [excerptAr, setExcerptAr] = useState(article?.excerptAr ?? "");
  const [contentFr, setContentFr] = useState(article?.contentFr ?? "");
  const [contentAr, setContentAr] = useState(article?.contentAr ?? "");
  const [published, setPublished] = useState(Boolean(article?.publishedAt));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const payload = { titleFr, titleAr, excerptFr, excerptAr, contentFr, contentAr, published };
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
      router.push("/admin/mag");
      router.refresh();
      return;
    }
    setError(t("errorGeneric"));
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
            className="w-full rounded-md border border-slate-300 px-3 py-2"
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
            className="w-full rounded-md border border-slate-300 px-3 py-2"
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
            className="w-full rounded-md border border-slate-300 px-3 py-2"
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
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </div>
      </div>

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
            className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm"
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
            className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm"
          />
        </div>
      </div>
      <p className="text-xs text-slate-500 -mt-4">{t("contentHelp")}</p>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
        {t("publishedLabel")}
      </label>

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
