"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";

export function ListingPriceEditor({
  listingId,
  currentPrice,
  newPriceLabel,
  editLabel,
  saveLabel,
  cancelLabel,
  errorLabel,
}: {
  listingId: string;
  currentPrice: number;
  newPriceLabel: string;
  editLabel: string;
  saveLabel: string;
  cancelLabel: string;
  errorLabel: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState(String(currentPrice));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = Number(price);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      setError(errorLabel);
      return;
    }

    setPending(true);
    setError(null);

    const res = await fetch(`/api/listings/${listingId}/update-price`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ price: parsed }),
    });

    setPending(false);
    if (res.ok) {
      setOpen(false);
      router.refresh();
      return;
    }
    setError(errorLabel);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          setOpen(true);
        }}
        className="text-xs text-slate-500 dark:text-slate-400 underline hover:text-slate-700 dark:hover:text-slate-200"
      >
        {editLabel}
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
        {newPriceLabel}
        <input
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="w-28 rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 px-2 py-1 text-sm text-slate-900"
        />
        DA
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {saveLabel}
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          setOpen(false);
          setPrice(String(currentPrice));
          setError(null);
        }}
        className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
      >
        {cancelLabel}
      </button>
      {error && <p role="alert" className="w-full text-xs text-red-600">{error}</p>}
    </form>
  );
}
