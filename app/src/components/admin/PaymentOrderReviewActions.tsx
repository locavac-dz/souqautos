"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

// `reviewUrl` généralise ce composant à toute revue "virement + approuver/
// refuser avec motif" (Lot 79 : réutilisé tel quel pour les demandes
// d'abonnement pro, mêmes actions et mêmes clés i18n que les demandes de
// formule d'annonce).
export function PaymentOrderReviewActions({ orderId, reviewUrl }: { orderId: string; reviewUrl?: string }) {
  const t = useTranslations("Admin");
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "approve" | "reject") {
    setPending(true);
    setError(null);

    const res = await fetch(reviewUrl ?? `/api/admin/payment-orders/${orderId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason: reason.trim() || undefined }),
    });

    setPending(false);

    if (res.ok) {
      router.refresh();
      return;
    }

    const body = await res.json().catch(() => null);
    setError(body?.error === "reason_required" ? t("reasonRequired") : t("actionError"));
  }

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={t("reasonPlaceholder")}
        className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => act("approve")}
          disabled={pending}
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {t("approve")}
        </button>
        <button
          type="button"
          onClick={() => act("reject")}
          disabled={pending}
          className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          {t("reject")}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
