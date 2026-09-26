"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

const ERROR_KEY: Record<string, string> = {
  reason_required: "errorReasonRequired",
  invalid_transition: "errorAlreadyModerated",
};

// Lot 116 — valider ou refuser un avis de propriétaire. Un refus exige un motif,
// transmis à l'auteur par email.
export function OwnerReviewModerationActions({ reviewId }: { reviewId: string }) {
  const t = useTranslations("AdminOwnerReview");
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "approve" | "reject") {
    setPending(true);
    setError(null);
    const res = await fetch(`/api/admin/owner-reviews/${reviewId}/moderate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason: reason.trim() || undefined }),
    });
    setPending(false);
    if (res.ok) {
      router.refresh();
      return;
    }
    const data = await res.json().catch(() => null);
    setError(t(ERROR_KEY[data?.error] ?? "errorGeneric"));
    // Un autre membre de l'équipe a peut-être déjà traité cet avis : on rafraîchit.
    if (data?.error === "invalid_transition") router.refresh();
  }

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={300}
        placeholder={t("reasonPlaceholder")}
        aria-label={t("reasonPlaceholder")}
        className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => act("approve")}
          disabled={pending}
          className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
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
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
