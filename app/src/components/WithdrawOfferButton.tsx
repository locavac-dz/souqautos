"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

export function WithdrawOfferButton({ offerId }: { offerId: string }) {
  const t = useTranslations("Offer");
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleWithdraw() {
    if (!confirm(t("confirmWithdraw"))) return;
    setLoading(true);
    await fetch(`/api/offers/${offerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "WITHDRAWN" }),
    });
    router.refresh();
  }

  return (
    <button
      onClick={handleWithdraw}
      disabled={loading}
      className="rounded-md border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
    >
      {loading ? "…" : t("withdraw")}
    </button>
  );
}
