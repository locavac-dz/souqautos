"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

// Lot 266 — « Relire chez Chargily » : l'admin fait relire une commande Chargily en attente par le serveur
// (POST /api/admin/payments/chargily/refresh) au lieu de trancher à l'aveugle ; la page se rafraîchit.
export function AdminChargilyRefresh({ kind, orderId }: { kind: "listing_formula" | "pro_subscription"; orderId: string }) {
  const t = useTranslations("AdminPayments");
  const router = useRouter();
  const [state, setState] = useState<{ phase: "idle" | "busy" | "done" | "error"; text?: string }>({ phase: "idle" });

  async function refresh() {
    setState({ phase: "busy" });
    const res = await fetch("/api/admin/payments/chargily/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, orderId }),
    });
    const data = (await res.json().catch(() => null)) as { status?: string; providerStatus?: string | null; error?: string } | null;
    if (!res.ok || !data?.status) {
      setState({ phase: "error" });
      return;
    }
    setState({ phase: "done", text: t("refreshResult", { provider: data.providerStatus ?? "?", status: data.status }) });
    router.refresh();
  }

  return (
    <div className="mt-2 text-xs">
      <button
        type="button"
        onClick={refresh}
        disabled={state.phase === "busy"}
        className="rounded-md border border-slate-300 dark:border-slate-600 px-2 py-1 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
      >
        {state.phase === "busy" ? t("refreshBusy") : t("refreshAtProvider")}
      </button>
      {state.phase === "done" && <span className="ms-2 text-slate-600 dark:text-slate-300">{state.text}</span>}
      {state.phase === "error" && <span role="alert" className="ms-2 text-red-600 dark:text-red-400">{t("refreshError")}</span>}
    </div>
  );
}
