"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

type Props = {
  listingId: string;
  isLoggedIn: boolean;
};

export function RequestVisitButton({ listingId, isLoggedIn }: Props) {
  const t = useTranslations("VisitRequest");
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function minDate(): string {
    const d = new Date();
    d.setHours(d.getHours() + 5);
    return d.toISOString().slice(0, 10);
  }

  function maxDate(): string {
    const d = new Date();
    d.setDate(d.getDate() + 60);
    return d.toISOString().slice(0, 10);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!date || !time) return;

    const proposedAt = new Date(`${date}T${time}:00`).toISOString();
    setLoading(true);
    try {
      const res = await fetch("/api/visit-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId, proposedAt, message: message || undefined }),
      });
      if (res.status === 201) {
        setSuccess(true);
      } else {
        const data = await res.json().catch(() => null);
        const code = data?.error as string | undefined;
        if (code === "too_soon") setError(t("errorTooSoon"));
        else if (code === "too_far") setError(t("errorTooFar"));
        else if (code === "already_pending") setError(t("errorAlreadyPending"));
        else if (code === "too_many_pending") setError(t("errorTooManyPending"));
        else if (code === "self_visit") setError(t("errorSelfVisit"));
        else if (code === "rate_limited") setError(t("errorRateLimited"));
        else setError(t("errorGeneric"));
      }
    } catch {
      setError(t("errorGeneric"));
    } finally {
      setLoading(false);
    }
  }

  if (!isLoggedIn) {
    return (
      <Link
        href="/connexion"
        className="flex w-full items-center justify-center gap-1.5 rounded-md border border-emerald-600 dark:border-emerald-500 px-4 py-2.5 text-sm font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950"
      >
        <span aria-hidden="true">📅</span>
        {t("buttonLabel")}
      </Link>
    );
  }

  return (
    <>
      <button
        onClick={() => { setOpen(true); setSuccess(false); setError(null); }}
        className="flex w-full items-center justify-center gap-1.5 rounded-md border border-emerald-600 dark:border-emerald-500 px-4 py-2.5 text-sm font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950"
      >
        <span aria-hidden="true">📅</span>
        {t("buttonLabel")}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="visit-modal-title"
            className="w-full max-w-sm rounded-xl bg-white dark:bg-slate-900 p-6 shadow-xl"
          >
            <h2 id="visit-modal-title" className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">
              {t("modalTitle")}
            </h2>

            {success ? (
              <div className="space-y-4">
                <p role="status" className="text-sm text-slate-700 dark:text-slate-300">{t("success")}</p>
                <button
                  onClick={() => setOpen(false)}
                  className="w-full rounded-md bg-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300 py-2 text-sm font-medium text-white hover:bg-slate-700"
                >
                  {t("close")}
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-3">
                <div>
                  <label htmlFor="visit-date" className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                    {t("dateLabel")}
                  </label>
                  <input
                    id="visit-date"
                    type="date"
                    required
                    autoFocus
                    min={minDate()}
                    max={maxDate()}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>

                <div>
                  <label htmlFor="visit-time" className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                    {t("timeLabel")}
                  </label>
                  <input
                    id="visit-time"
                    type="time"
                    required
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>

                <div>
                  <label htmlFor="visit-message" className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                    {t("messageLabel")}
                  </label>
                  <textarea
                    id="visit-message"
                    maxLength={500}
                    rows={2}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={t("messagePlaceholder")}
                    className="w-full rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
                  />
                </div>

                {error && <p role="alert" className="text-xs text-red-600">{error}</p>}

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="flex-1 rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-800 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    {t("cancel")}
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 rounded-md bg-emerald-600 dark:bg-emerald-500 py-2 text-sm font-medium text-white hover:bg-emerald-700 dark:hover:bg-emerald-600 disabled:opacity-50"
                  >
                    {loading ? t("sending") : t("submit")}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
