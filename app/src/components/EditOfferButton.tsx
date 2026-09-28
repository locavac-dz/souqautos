"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

type Props = { offerId: string; currentAmount: number };

export function EditOfferButton({ offerId, currentAmount }: Props) {
  const t = useTranslations("Offer");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(currentAmount));
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseInt(amount, 10);
    if (!parsed || parsed <= 0) { setError(t("errorInvalidAmount")); return; }
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/offers/${offerId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: parsed, message: message.trim() || undefined }),
    });
    setLoading(false);
    if (res.ok) {
      setOpen(false);
      router.refresh();
    } else {
      setError(t("errorGeneric"));
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-slate-300 dark:border-slate-600 px-3 py-1 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
      >
        {t("editOffer")}
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex items-center rounded-md border border-slate-300 bg-white focus-within:ring-2 focus-within:ring-emerald-500 dark:border-slate-600 dark:bg-slate-800">
        <input
          type="number"
          inputMode="numeric"
          min={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-28 bg-transparent px-2 py-1 text-sm outline-none"
          autoFocus
        />
        <span className="pr-2 text-xs text-slate-400">DA</span>
      </div>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={500}
        rows={2}
        placeholder={t("messagePlaceholder")}
        className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-600 dark:bg-slate-800"
      />
      {error && <p role="alert" className="text-xs text-red-500">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-emerald-700 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {loading ? "…" : t("editSubmit")}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setAmount(String(currentAmount)); setError(null); }}
          className="rounded-md border border-slate-300 dark:border-slate-600 px-3 py-1 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          {t("cancel")}
        </button>
      </div>
    </form>
  );
}
