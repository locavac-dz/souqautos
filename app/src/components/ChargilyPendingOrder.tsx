"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

// Lot 264 — commande Chargily EN_ATTENTE : « Vérifier le paiement » demande au serveur de relire le
// statut chez Chargily (/api/payments/chargily/refresh). Utile quand le webhook n'est pas (encore)
// arrivé ; ce n'est pas l'acheteur qui affirme avoir payé, c'est le prestataire qui est interrogé.
export function ChargilyPendingOrder({
  kind,
  orderId,
  pendingLabel,
}: {
  kind: "listing_formula" | "pro_subscription";
  orderId: string;
  pendingLabel: string;
}) {
  const t = useTranslations("Payment");
  const router = useRouter();
  const [state, setState] = useState<"idle" | "checking" | "still_pending" | "canceled" | "error">("idle");

  async function refresh() {
    setState("checking");
    const res = await fetch("/api/payments/chargily/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, orderId }),
    });
    const data = (await res.json().catch(() => null)) as { status?: string } | null;
    if (!res.ok || !data?.status) {
      setState("error");
      return;
    }
    if (data.status === "CONFIRMEE" || data.status === "ANNULEE") {
      setState(data.status === "ANNULEE" ? "canceled" : "idle");
      router.refresh();
      return;
    }
    setState("still_pending");
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
      <span>{pendingLabel}</span>
      <button
        type="button"
        onClick={refresh}
        disabled={state === "checking"}
        className="rounded-md border border-slate-300 dark:border-slate-600 px-2 py-0.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
      >
        {state === "checking" ? t("checking") : t("checkPayment")}
      </button>
      {state === "still_pending" && <span>{t("stillPending")}</span>}
      {state === "canceled" && <span className="text-amber-700 dark:text-amber-300">{t("canceled")}</span>}
      {state === "error" && <span role="alert" className="text-red-600 dark:text-red-400">{t("checkError")}</span>}
    </div>
  );
}
