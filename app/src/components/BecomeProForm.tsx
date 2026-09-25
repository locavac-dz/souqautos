"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

export function BecomeProForm({ wilayas }: { wilayas: { id: number; nomFr: string; nomAr: string }[] }) {
  const t = useTranslations("Pro");
  const locale = useLocale();
  const router = useRouter();
  const [nomCommercial, setNomCommercial] = useState("");
  const [presentation, setPresentation] = useState("");
  const [horaires, setHoraires] = useState("");
  const [wilayaId, setWilayaId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const res = await fetch("/api/pro/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nomCommercial: nomCommercial.trim(),
        presentation: presentation.trim() || undefined,
        horaires: horaires.trim() || undefined,
        wilayaId: wilayaId ? Number(wilayaId) : undefined,
      }),
    });

    setPending(false);

    if (res.ok) {
      router.push("/pro/tableau-de-bord");
      router.refresh();
      return;
    }

    const body = await res.json().catch(() => null);
    setError(body?.error === "already_professional" ? t("alreadyProfessional") : t("errorGeneric"));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block">
        <span className="text-sm text-slate-700 dark:text-slate-300">{t("nomCommercialLabel")}</span>
        <input
          type="text"
          value={nomCommercial}
          onChange={(e) => setNomCommercial(e.target.value)}
          required
          maxLength={100}
          className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 px-3 py-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="text-sm text-slate-700 dark:text-slate-300">{t("presentationLabel")}</span>
        <textarea
          value={presentation}
          onChange={(e) => setPresentation(e.target.value)}
          maxLength={2000}
          rows={4}
          className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 px-3 py-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="text-sm text-slate-700 dark:text-slate-300">{t("horairesLabel")}</span>
        <input
          type="text"
          value={horaires}
          onChange={(e) => setHoraires(e.target.value)}
          maxLength={200}
          placeholder={t("horairesPlaceholder")}
          className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 px-3 py-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="text-sm text-slate-700 dark:text-slate-300">{t("wilayaLabel")}</span>
        <select
          value={wilayaId}
          onChange={(e) => setWilayaId(e.target.value)}
          className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 px-3 py-2 text-sm"
        >
          <option value="">{t("wilayaPlaceholder")}</option>
          {wilayas.map((w) => (
            <option key={w.id} value={w.id}>
              {locale === "ar" ? w.nomAr : w.nomFr}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {t("submit")}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
