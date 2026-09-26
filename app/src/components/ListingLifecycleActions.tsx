"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";

export function ListingLifecycleActions({
  listingId,
  canRenew,
  canMarkSold,
  renewLabel,
  markSoldLabel,
  errorLabel,
}: {
  listingId: string;
  canRenew: boolean;
  canMarkSold: boolean;
  renewLabel: string;
  markSoldLabel: string;
  errorLabel: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<"renew" | "mark-sold" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handle(action: "renew" | "mark-sold") {
    setPending(action);
    setError(null);

    const res = await fetch(`/api/listings/${listingId}/${action}`, { method: "POST" });

    setPending(null);
    if (res.ok) {
      router.refresh();
      return;
    }
    setError(errorLabel);
  }

  if (!canRenew && !canMarkSold) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canRenew && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            handle("renew");
          }}
          disabled={pending !== null}
          className="rounded-md border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
        >
          {renewLabel}
        </button>
      )}
      {canMarkSold && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            handle("mark-sold");
          }}
          disabled={pending !== null}
          className="rounded-md border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
        >
          {markSoldLabel}
        </button>
      )}
      {error && <p role="alert" className="w-full text-xs text-red-600">{error}</p>}
    </div>
  );
}
