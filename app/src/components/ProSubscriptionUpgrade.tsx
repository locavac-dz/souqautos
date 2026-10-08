"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

type Tier = "BUSINESS" | "PRO" | "PREMIUM";

type BankDetails = { bankName: string; bankRib: string; bankAccountHolder: string };

// Même patron que ListingFormulaUpgrade.tsx (Lot 66, Lot 264) : paiement en ligne Chargily Pay quand il
// est configuré, virement bancaire manuel en repli — jamais de fausse intégration de paiement.
export function ProSubscriptionUpgrade({
  accountId,
  targetTier,
  bankDetails,
  onlinePayment,
  priceDzd,
}: {
  accountId: string;
  targetTier: Tier;
  bankDetails: BankDetails | null;
  onlinePayment: boolean;
  priceDzd: number;
}) {
  const t = useTranslations("Pro");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reference, setReference] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tierLabel = t(`subscriptionTier${targetTier}`);

  async function payOnline() {
    setPending(true);
    setError(null);
    const res = await fetch(`/api/pro/accounts/${accountId}/subscription/upgrade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier: targetTier, method: "chargily" }),
    });
    const data = (await res.json().catch(() => null)) as { checkoutUrl?: string } | null;
    if (res.ok && data?.checkoutUrl) {
      window.location.assign(data.checkoutUrl);
      return;
    }
    setPending(false);
    setError(t("subscriptionPayOnlineError"));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (reference.trim().length < 2) {
      setError(t("subscriptionUpgradeErrorGeneric"));
      return;
    }

    setPending(true);
    setError(null);

    const res = await fetch(`/api/pro/accounts/${accountId}/subscription/upgrade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier: targetTier, method: "virement", reference: reference.trim() }),
    });

    setPending(false);
    if (res.ok) {
      setOpen(false);
      router.refresh();
      return;
    }
    setError(t("subscriptionUpgradeErrorGeneric"));
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          setOpen(true);
        }}
        className="rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
      >
        {t("subscriptionUpgradeTo", { tier: tierLabel })} — {priceDzd.toLocaleString()} DA/{t("subscriptionPerMonth")}
      </button>
    );
  }

  return (
    <div className="w-full max-w-md rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 space-y-3">
      {onlinePayment && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
            {t("subscriptionPayOnlineTitle", { tier: tierLabel, amount: priceDzd.toLocaleString() })}
          </p>
          <button
            type="button"
            onClick={payOnline}
            disabled={pending}
            className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
          >
            {t("subscriptionPayOnlineButton")}
          </button>
          <p className="text-xs text-slate-500 dark:text-slate-400">{t("subscriptionPayOnlineHint")}</p>
        </div>
      )}

      {onlinePayment && bankDetails && (
        <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">{t("subscriptionPayOrByTransfer")}</p>
      )}

      {bankDetails && (
        <form onSubmit={handleSubmit} className="space-y-2">
          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
            {t("subscriptionUpgradeInstructions", { amount: priceDzd.toLocaleString() })}
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            {t("subscriptionUpgradeBankName")}: <strong>{bankDetails.bankName}</strong>
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-300 font-mono">
            {t("subscriptionUpgradeBankRib")}: <span dir="ltr">{bankDetails.bankRib}</span>
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            {t("subscriptionUpgradeBankHolder")}: {bankDetails.bankAccountHolder}
          </p>
          <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            {t("subscriptionUpgradeReferenceLabel")}
            <input
              type="text"
              required
              minLength={2}
              maxLength={80}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder={t("subscriptionUpgradeReferencePlaceholder")}
              className="flex-1 rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 px-2 py-1 text-sm text-slate-900"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {t("subscriptionUpgradeSubmit")}
          </button>
        </form>
      )}

      <button
        type="button"
        onClick={() => {
          setOpen(false);
          setError(null);
        }}
        className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
      >
        {t("subscriptionUpgradeCancel")}
      </button>
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
