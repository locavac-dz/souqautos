"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

type Props = {
  listingId: string;
  listingPrice: number;
  isLoggedIn: boolean;
  hasPendingOffer: boolean;
};

export function MakeOfferButton({ listingId, listingPrice, isLoggedIn, hasPendingOffer }: Props) {
  const t = useTranslations("Offer");
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<string>("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function handleOpen() {
    if (!isLoggedIn) {
      router.push("/auth/connexion");
      return;
    }
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseInt(amount, 10);
    if (!parsed || parsed <= 0) {
      setError(t("errorInvalidAmount"));
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/listings/${listingId}/offers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: parsed, message: message.trim() || undefined }),
    });
    setLoading(false);
    if (res.ok) {
      setDone(true);
    } else {
      const data = await res.json().catch(() => ({}));
      if (data.error === "offer_pending") setError(t("errorPending"));
      else if (data.error === "rate_limited") setError(t("errorRateLimit"));
      else setError(t("errorGeneric"));
    }
  }

  if (!open) {
    if (hasPendingOffer) {
      return (
        <div className="w-full rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-center text-sm font-medium text-amber-700 dark:border-amber-600 dark:bg-amber-950/30 dark:text-amber-400">
          {t("pendingBadge")}
        </div>
      );
    }
    return (
      <button
        onClick={handleOpen}
        className="w-full rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 active:bg-emerald-900"
      >
        {t("cta")}
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
    >
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          {t("modalTitle")}
        </h2>

        {done ? (
          <div className="mt-4 space-y-4">
            <p className="text-slate-700 dark:text-slate-300">{t("successMessage")}</p>
            <button
              onClick={() => { setOpen(false); setDone(false); setAmount(""); setMessage(""); }}
              className="w-full rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
            >
              {t("close")}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t("priceHint", { price: listingPrice.toLocaleString() })}
            </p>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                {t("amountLabel")}
              </label>
              <div className="flex items-center rounded-md border border-slate-300 bg-white focus-within:ring-2 focus-within:ring-emerald-500 dark:border-slate-600 dark:bg-slate-800">
                <input
                  type="number"
                  min={1}
                  max={1_000_000_000}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  required
                  className="flex-1 bg-transparent px-3 py-2 text-sm outline-none"
                />
                <span className="pr-3 text-sm text-slate-400">DA</span>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                {t("messageLabel")}
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder={t("messagePlaceholder")}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-600 dark:bg-slate-800"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {t("cancel")}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
              >
                {loading ? t("sending") : t("submit")}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
