"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

export function RespondOfferButtons({ offerId }: { offerId: string }) {
  const t = useTranslations("Offer");
  const router = useRouter();
  const [loading, setLoading] = useState<"ACCEPTED" | "DECLINED" | "COUNTERED" | null>(null);
  const [counterOpen, setCounterOpen] = useState(false);
  const [counterAmount, setCounterAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function respond(action: "ACCEPTED" | "DECLINED") {
    setLoading(action);
    await fetch(`/api/offers/${offerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    router.refresh();
  }

  async function submitCounter(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseInt(counterAmount, 10);
    if (!parsed || parsed <= 0) { setError(t("errorInvalidAmount")); return; }
    setLoading("COUNTERED");
    setError(null);
    const res = await fetch(`/api/offers/${offerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "COUNTERED", counterAmount: parsed }),
    });
    if (res.ok) {
      router.refresh();
    } else {
      setLoading(null);
      setError(t("errorGeneric"));
    }
  }

  if (counterOpen) {
    return (
      <form onSubmit={submitCounter} className="flex flex-col gap-2">
        <div className="flex items-center rounded-md border border-slate-300 bg-white focus-within:ring-2 focus-within:ring-emerald-500 dark:border-slate-600 dark:bg-slate-800">
          <input
            type="number"
            min={1}
            value={counterAmount}
            onChange={(e) => setCounterAmount(e.target.value)}
            placeholder="Montant DA"
            className="w-28 bg-transparent px-2 py-1 text-sm outline-none"
            autoFocus
          />
          <span className="pr-2 text-xs text-slate-400">DA</span>
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading === "COUNTERED"}
            className="rounded-md bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading === "COUNTERED" ? "…" : t("counterSubmit")}
          </button>
          <button
            type="button"
            onClick={() => { setCounterOpen(false); setCounterAmount(""); setError(null); }}
            className="rounded-md border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
          >
            {t("cancel")}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => respond("ACCEPTED")}
        disabled={loading !== null}
        className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {loading === "ACCEPTED" ? "…" : t("accept")}
      </button>
      <button
        onClick={() => setCounterOpen(true)}
        disabled={loading !== null}
        className="rounded-md bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {t("counter")}
      </button>
      <button
        onClick={() => respond("DECLINED")}
        disabled={loading !== null}
        className="rounded-md border border-red-300 px-3 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        {loading === "DECLINED" ? "…" : t("decline")}
      </button>
    </div>
  );
}
