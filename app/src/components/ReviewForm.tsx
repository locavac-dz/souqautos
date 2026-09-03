"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

export function ReviewForm({ endpoint }: { endpoint: string }) {
  const t = useTranslations("Review");
  const router = useRouter();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, comment: comment.trim() || undefined }),
    });

    setPending(false);

    if (res.ok) {
      setDone(true);
      router.refresh();
      return;
    }

    const responseBody = await res.json().catch(() => null);
    setError(
      responseBody?.error === "already_reviewed"
        ? t("alreadyReviewed")
        : responseBody?.error === "no_interaction"
          ? t("noInteraction")
          : responseBody?.error === "cannot_review_self"
            ? t("cannotReviewSelf")
            : t("errorGeneric")
    );
  }

  if (done) {
    return <p className="text-sm text-emerald-700">{t("alreadyReviewed")}</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-md border border-slate-200 p-4 space-y-3">
      <p className="font-medium text-sm text-slate-900">{t("leaveReview")}</p>
      <label className="block">
        <span className="text-xs text-slate-500">{t("ratingLabel")}</span>
        <select
          value={rating}
          onChange={(e) => setRating(Number(e.target.value))}
          className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        >
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {"★".repeat(n)}
              {"☆".repeat(5 - n)} ({n}/5)
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-xs text-slate-500">{t("commentLabel")}</span>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={1000}
          rows={3}
          className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {t("submit")}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
  );
}
