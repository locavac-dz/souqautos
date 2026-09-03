"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

export function ToggleProVerifiedButton({ accountId, verified }: { accountId: string; verified: boolean }) {
  const t = useTranslations("Admin");
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function toggle() {
    setPending(true);
    const res = await fetch(`/api/admin/pro/${accountId}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verified: !verified }),
    });
    setPending(false);
    if (res.ok) {
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className={`rounded-md border px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${
        verified
          ? "border-slate-300 text-slate-700 hover:bg-slate-50"
          : "bg-emerald-600 text-white hover:bg-emerald-700 border-emerald-600"
      }`}
    >
      {verified ? t("revokeProBadge") : t("grantProBadge")}
    </button>
  );
}
