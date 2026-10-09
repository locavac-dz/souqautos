"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

// `reviewUrl` généralise ce composant à toute revue "virement + approuver/
// refuser avec motif" (Lot 79 : réutilisé tel quel pour les demandes
// d'abonnement pro, mêmes actions et mêmes clés i18n que les demandes de
// formule d'annonce).
// Lot 278 — `dualApproval` : au-dessus du seuil, deux administrateurs différents doivent approuver ; le composant
// montre où on en est et empêche la même personne de donner les deux validations.
export type DualApprovalState = {
  required: boolean;
  firstApprovedByEmail: string | null;
  firstApprovedAt: string | null;
  firstApprovedByMe: boolean;
};

export function PaymentOrderReviewActions({
  orderId,
  reviewUrl,
  dualApproval,
}: {
  orderId: string;
  reviewUrl?: string;
  dualApproval?: DualApprovalState;
}) {
  const t = useTranslations("Admin");
  const tPayments = useTranslations("AdminPayments");
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
    // Lot 265/266 — codes renvoyés par les routes de revue : annonce plus publiable, prestataire en désaccord.
    const KEY_BY_ERROR: Record<string, string> = {
      reason_required: "reasonRequired",
      listing_not_upgradable: "paymentListingNotUpgradable",
      paid_at_provider: "paymentPaidAtProvider",
      not_paid_at_provider: "paymentNotPaidAtProvider",
      provider_unavailable: "paymentProviderUnavailable",
      chargily_not_configured: "paymentProviderUnavailable",
      second_approver_required: "paymentSecondApproverRequired",
    };
    setError(t(KEY_BY_ERROR[body?.error as string] ?? "actionError"));
  }

  const dual = dualApproval?.required ? dualApproval : null;
  const approveLabel = !dual ? t("approve") : dual.firstApprovedByEmail ? tPayments("approveSecond") : tPayments("approveFirst");
  const approveBlocked = Boolean(dual?.firstApprovedByMe);

  return (
    <div className="space-y-2">
      {dual && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <p>{tPayments("dualApprovalRequired")}</p>
          {dual.firstApprovedByEmail && (
            <p className="mt-1">
              {tPayments("dualApprovalFirstBy", { email: dual.firstApprovedByEmail, date: dual.firstApprovedAt ?? "" })}{" "}
              {dual.firstApprovedByMe ? tPayments("dualApprovalYouApproved") : tPayments("dualApprovalAwaiting")}
            </p>
          )}
        </div>
      )}
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
          disabled={pending || approveBlocked}
          className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {approveLabel}
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
