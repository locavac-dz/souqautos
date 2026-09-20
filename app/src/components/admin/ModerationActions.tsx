"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { ModerationAction } from "@/lib/moderation";

export function ModerationActions({
  listingId,
  status,
}: {
  listingId: string;
  status: "EN_ATTENTE" | "PUBLIEE" | "SUSPENDUE";
}) {
  const t = useTranslations("Admin");
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(action: ModerationAction) {
    setPending(true);
    setError(null);

    const res = await fetch(`/api/admin/listings/${listingId}/moderate`, {
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

  const needsReason = status === "EN_ATTENTE" || status === "PUBLIEE";

  return (
    <div className="space-y-2">
      {needsReason && (
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t("reasonPlaceholder")}
          className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
      )}
      <div className="flex gap-2">
        {(status === "EN_ATTENTE" || status === "SUSPENDUE") && (
          <button
            type="button"
            onClick={() => act("approve")}
            disabled={pending}
            className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            {t("approve")}
          </button>
        )}
        {status === "EN_ATTENTE" && (
          <button
            type="button"
            onClick={() => act("reject")}
            disabled={pending}
            className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            {t("reject")}
          </button>
        )}
        {status === "PUBLIEE" && (
          <button
            type="button"
            onClick={() => act("suspend")}
            disabled={pending}
            className="rounded-md border border-orange-300 px-3 py-1.5 text-sm font-medium text-orange-700 hover:bg-orange-50 disabled:opacity-50"
          >
            {t("suspend")}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
