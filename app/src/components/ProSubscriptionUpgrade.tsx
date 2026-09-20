"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

type Tier = "BUSINESS" | "PRO" | "PREMIUM";

type BankDetails = { bankName: string; bankRib: string; bankAccountHolder: string };

// Même patron que ListingFormulaUpgrade.tsx (Lot 66) : virement bancaire
// manuel, rapprochement humain, jamais de fausse intégration de paiement.
export function ProSubscriptionUpgrade({
  accountId,
  targetTier,
  bankDetails,
  priceDzd,
}: {
  accountId: string;
  targetTier: Tier;
  bankDetails: BankDetails;
  priceDzd: number;
}) {
  const t = useTranslations("Pro");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reference, setReference] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tierLabel = t(`subscriptionTier${targetTier}`);

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
      body: JSON.stringify({ tier: targetTier, reference: reference.trim() }),
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
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
      >
        {t("subscriptionUpgradeTo", { tier: tierLabel })} — {priceDzd.toLocaleString()} DA/{t("subscriptionPerMonth")}
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md rounded-md border border-slate-200 bg-slate-50 p-3 space-y-2">
      <p className="text-xs font-medium text-slate-700">
        {t("subscriptionUpgradeInstructions", { amount: priceDzd.toLocaleString() })}
      </p>
      <p className="text-xs text-slate-600">
        {t("subscriptionUpgradeBankName")}: <strong>{bankDetails.bankName}</strong>
      </p>
      <p className="text-xs text-slate-600 font-mono">
        {t("subscriptionUpgradeBankRib")}: <span dir="ltr">{bankDetails.bankRib}</span>
      </p>
      <p className="text-xs text-slate-600">
        {t("subscriptionUpgradeBankHolder")}: {bankDetails.bankAccountHolder}
      </p>
      <label className="flex items-center gap-2 text-xs text-slate-500">
        {t("subscriptionUpgradeReferenceLabel")}
        <input
          type="text"
          required
          minLength={2}
          maxLength={80}
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder={t("subscriptionUpgradeReferencePlaceholder")}
          className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-900"
        />
      </label>
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {t("subscriptionUpgradeSubmit")}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="text-xs text-slate-500 hover:text-slate-600"
        >
          {t("subscriptionUpgradeCancel")}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
  );
}
