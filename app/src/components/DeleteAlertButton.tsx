"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

export function DeleteAlertButton({ alertId }: { alertId: string }) {
  const t = useTranslations("Alerts");
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleDelete() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setPending(true);
    const res = await fetch(`/api/alerts/${alertId}`, { method: "DELETE" });
    setPending(false);
    if (res.ok) {
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      onBlur={() => setConfirming(false)}
      disabled={pending}
      className="shrink-0 text-xs text-slate-500 hover:text-red-600 disabled:opacity-50"
    >
      {confirming ? t("confirmDelete") : t("delete")}
    </button>
  );
}
