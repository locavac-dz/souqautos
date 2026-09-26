"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

type PreferredTime = "MATIN" | "APRES_MIDI" | "SOIR" | "PEU_IMPORTE";

export function CallbackRequestButton({ listingId }: { listingId: string }) {
  const t = useTranslations("CallbackRequest");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [preferred, setPreferred] = useState<PreferredTime>("PEU_IMPORTE");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const TIMES: PreferredTime[] = ["MATIN", "APRES_MIDI", "SOIR", "PEU_IMPORTE"];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/callback-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId, callerName: name, callerPhone: phone, preferredTime: preferred }),
      });
      if (res.status === 201) {
        setSuccess(true);
      } else {
        const data = await res.json().catch(() => null);
        if (data?.issues?.some((i: { path: string[] }) => i.path.includes("callerPhone"))) {
          setError(t("errorPhone"));
        } else {
          setError(t("errorGeneric"));
        }
      }
    } catch {
      setError(t("errorGeneric"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => { setOpen(true); setSuccess(false); setError(null); }}
        className="flex items-center gap-1.5 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
      >
        <span>📞</span>
        {t("buttonLabel")}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="w-full max-w-sm rounded-xl bg-white dark:bg-slate-900 p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">{t("modalTitle")}</h2>

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
                  <label htmlFor="callback-name" className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">{t("nameLabel")}</label>
                  <input
                    id="callback-name"
                    required
                    minLength={2}
                    maxLength={100}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("namePlaceholder")}
                    className="w-full rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                </div>

                <div>
                  <label htmlFor="callback-phone" className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">{t("phoneLabel")}</label>
                  <input
                    id="callback-phone"
                    required
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={t("phonePlaceholder")}
                    className="w-full rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">{t("preferredTimeLabel")}</label>
                  <select
                    value={preferred}
                    onChange={(e) => setPreferred(e.target.value as PreferredTime)}
                    className="w-full rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                  >
                    {TIMES.map((v) => (
                      <option key={v} value={v}>{t(`preferredTime${v}`)}</option>
                    ))}
                  </select>
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
                    className="flex-1 rounded-md bg-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
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
