"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

type Formula = "PREMIUM" | "PREMIUM_PLUS";

type BankDetails = { bankName: string; bankRib: string; bankAccountHolder: string };

export function ListingFormulaUpgrade({
  listingId,
  formula,
  bankDetails,
  premiumPriceDzd,
  premiumPlusPriceDzd,
}: {
  listingId: string;
  formula: Formula;
  bankDetails: BankDetails;
  premiumPriceDzd: number;
  premiumPlusPriceDzd: number;
}) {
  const t = useTranslations("MyListings");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reference, setReference] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const price = formula === "PREMIUM" ? premiumPriceDzd : premiumPlusPriceDzd;
  const label = formula === "PREMIUM" ? t("upgradeToPremium") : t("upgradeToPremiumPlus");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (reference.trim().length < 2) {
      setError(t("upgradeErrorGeneric"));
      return;
    }

    setPending(true);
    setError(null);

    const res = await fetch(`/api/listings/${listingId}/upgrade-formula`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formula, reference: reference.trim() }),
    });

    setPending(false);
    if (res.ok) {
      setOpen(false);
      router.refresh();
      return;
    }
    setError(t("upgradeErrorGeneric"));
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          setOpen(true);
        }}
        className="text-xs text-slate-500 underline hover:text-slate-700"
      >
        {label} — {price.toLocaleString()} DA
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full rounded-md border border-slate-200 bg-slate-50 p-3 space-y-2"
    >
      <p className="text-xs font-medium text-slate-700">
        {t("upgradeInstructions", { amount: price.toLocaleString() })}
      </p>
      <p className="text-xs text-slate-600">
        {t("upgradeBankName")}: <strong>{bankDetails.bankName}</strong>
      </p>
      <p className="text-xs text-slate-600 font-mono">
        {t("upgradeBankRib")}: <span dir="ltr">{bankDetails.bankRib}</span>
      </p>
      <p className="text-xs text-slate-600">
        {t("upgradeBankHolder")}: {bankDetails.bankAccountHolder}
      </p>
      <label className="flex items-center gap-2 text-xs text-slate-500">
        {t("upgradeReferenceLabel")}
        <input
          type="text"
          required
          minLength={2}
          maxLength={80}
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder={t("upgradeReferencePlaceholder")}
          className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-900"
        />
      </label>
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {t("upgradeSubmit")}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="text-xs text-slate-500 hover:text-slate-600"
        >
          {t("upgradeCancel")}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
  );
}
