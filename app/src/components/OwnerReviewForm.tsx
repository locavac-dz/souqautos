"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

type Existing = {
  rating: number;
  comment: string;
  purchaseYear: number | null;
  mileageKm: number | null;
};

const inputClass = "w-full rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 px-3 py-2 text-sm";

const ERROR_KEY: Record<string, string> = {
  rate_limited: "errorRateLimited",
  already_reviewed: "errorAlreadyReviewed",
  email_not_verified: "errorEmailNotVerified",
  validation: "errorValidation",
};

// Lot 116 — formulaire d'avis de propriétaire : création, modification (qui
// remet l'avis en attente de validation) et retrait.
export function OwnerReviewForm({
  modelId,
  existing,
  currentYear,
}: {
  modelId: number;
  existing: Existing | null;
  // Année courante fournie par le serveur : un composant client ne lit pas
  // l'horloge pendant son rendu.
  currentYear: number;
}) {
  const t = useTranslations("OwnerReview");
  const router = useRouter();

  const [rating, setRating] = useState(existing ? String(existing.rating) : "");
  const [comment, setComment] = useState(existing?.comment ?? "");
  const [purchaseYear, setPurchaseYear] = useState(existing?.purchaseYear ? String(existing.purchaseYear) : "");
  const [mileageKm, setMileageKm] = useState(existing?.mileageKm !== null && existing?.mileageKm !== undefined ? String(existing.mileageKm) : "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const endpoint = `/api/models/${modelId}/owner-reviews`;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);

    const res = await fetch(endpoint, {
      method: existing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rating: Number(rating),
        comment,
        purchaseYear: purchaseYear ? Number(purchaseYear) : undefined,
        mileageKm: mileageKm !== "" ? Number(mileageKm) : undefined,
      }),
    });
    setPending(false);

    if (res.ok) {
      setSaved(true);
      router.refresh();
      return;
    }
    const data = await res.json().catch(() => null);
    setError(t(ERROR_KEY[data?.error] ?? "errorGeneric"));
  }

  async function handleDelete() {
    setPending(true);
    setError(null);
    const res = await fetch(endpoint, { method: "DELETE" });
    setPending(false);
    if (res.ok) {
      router.refresh();
      return;
    }
    setError(t("errorGeneric"));
  }

  const years = Array.from({ length: currentYear - 1990 + 1 }, (_, i) => currentYear - i);

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="orRating" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {t("ratingLabel")}
          </label>
          <select id="orRating" value={rating} onChange={(e) => setRating(e.target.value)} required className={`${inputClass} bg-white dark:bg-slate-800`}>
            <option value="" disabled>
              —
            </option>
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {n} / 5
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="orYear" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {t("purchaseYearLabel")}
          </label>
          <select id="orYear" value={purchaseYear} onChange={(e) => setPurchaseYear(e.target.value)} className={`${inputClass} bg-white dark:bg-slate-800`}>
            <option value="">—</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="orKm" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {t("mileageLabel")}
          </label>
          <input
            id="orKm"
            type="number"
            inputMode="numeric"
            min={0}
            max={1000000}
            value={mileageKm}
            onChange={(e) => setMileageKm(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="orComment" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          {t("commentLabel")}
        </label>
        <textarea
          id="orComment"
          dir="auto"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          minLength={40}
          maxLength={2000}
          rows={6}
          required
          className={inputClass}
        />
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t("formHelp")}</p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-emerald-700">{t("saved")}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {pending ? t("saving") : existing ? t("update") : t("submit")}
        </button>
        {existing && (
          <button type="button" onClick={handleDelete} disabled={pending} className="text-sm text-red-600 hover:underline disabled:opacity-50">
            {t("withdraw")}
          </button>
        )}
      </div>
    </form>
  );
}
