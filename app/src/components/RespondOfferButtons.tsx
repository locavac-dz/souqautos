"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

export function RespondOfferButtons({ offerId }: { offerId: string }) {
  const t = useTranslations("Offer");
  const router = useRouter();
  const [loading, setLoading] = useState<"ACCEPTED" | "DECLINED" | null>(null);

  async function respond(action: "ACCEPTED" | "DECLINED") {
    setLoading(action);
    await fetch(`/api/offers/${offerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    router.refresh();
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => respond("ACCEPTED")}
        disabled={loading !== null}
        className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {loading === "ACCEPTED" ? "…" : t("accept")}
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
