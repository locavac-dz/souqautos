"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

// Lot 82 — même patron que les autres actions vendeur de cette page
// (ListingLifecycleActions, ListingPriceEditor) : optimiste au clic, revert
// silencieux en cas d'échec serveur (par ex. palier rétrogradé entre-temps).
export function ListingAutoRenewToggle({
  listingId,
  initialAutoRenew,
}: {
  listingId: string;
  initialAutoRenew: boolean;
}) {
  const t = useTranslations("MyListings");
  const router = useRouter();
  const [autoRenew, setAutoRenew] = useState(initialAutoRenew);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const next = !autoRenew;
    setPending(true);
    setError(null);
    setAutoRenew(next);

    const res = await fetch(`/api/listings/${listingId}/auto-renew`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autoRenew: next }),
    });

    setPending(false);
    if (res.ok) {
      router.refresh();
      return;
    }
    setAutoRenew(!next);
    setError(t("autoRenewErrorGeneric"));
  }

  return (
    <div>
      <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
        <input type="checkbox" checked={autoRenew} disabled={pending} onChange={toggle} className="rounded" />
        {t("autoRenewLabel")}
      </label>
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
