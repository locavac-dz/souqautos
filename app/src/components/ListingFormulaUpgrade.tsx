"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

type Formula = "PREMIUM" | "PREMIUM_PLUS";

type BankDetails = { bankName: string; bankRib: string; bankAccountHolder: string };

// Lot 264 — deux moyens de paiement dans le même panneau : en ligne (Chargily Pay, CIB / Edahabia :
// le navigateur est envoyé sur la page de paiement hébergée) et, en repli, le virement bancaire manuel
// (Lot 66). Chacun n'apparaît que s'il est réellement disponible (clé Chargily configurée /
// coordonnées bancaires renseignées) — jamais un bouton qui ne marcherait pas.
export function ListingFormulaUpgrade({
  listingId,
  formula,
  bankDetails,
  onlinePayment,
  premiumPriceDzd,
  premiumPlusPriceDzd,
}: {
  listingId: string;
  formula: Formula;
  bankDetails: BankDetails | null;
  onlinePayment: boolean;
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

  async function payOnline() {
    setPending(true);
    setError(null);
    const res = await fetch(`/api/listings/${listingId}/upgrade-formula`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formula, method: "chargily" }),
    });
    const data = (await res.json().catch(() => null)) as { checkoutUrl?: string } | null;
    if (res.ok && data?.checkoutUrl) {
      // Page de paiement hébergée par Chargily ; le retour se fait sur « Mes annonces » (?paiement=…).
      window.location.assign(data.checkoutUrl);
      return;
    }
    setPending(false);
    setError(t("payOnlineError"));
  }

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
      body: JSON.stringify({ formula, method: "virement", reference: reference.trim() }),
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
        className="text-xs text-slate-500 dark:text-slate-400 underline hover:text-slate-700 dark:hover:text-slate-200"
      >
        {label} — {price.toLocaleString()} DA
      </button>
    );
  }

  return (
    <div className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 space-y-3">
      {onlinePayment && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{t("payOnlineTitle", { amount: price.toLocaleString() })}</p>
          <button
            type="button"
            onClick={payOnline}
            disabled={pending}
            className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
          >
            {t("payOnlineButton")}
          </button>
          <p className="text-xs text-slate-500 dark:text-slate-400">{t("payOnlineHint")}</p>
        </div>
      )}

      {onlinePayment && bankDetails && (
        <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">{t("payOrByTransfer")}</p>
      )}

      {bankDetails && (
        <form onSubmit={handleSubmit} className="space-y-2">
          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
            {t("upgradeInstructions", { amount: price.toLocaleString() })}
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            {t("upgradeBankName")}: <strong>{bankDetails.bankName}</strong>
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-300 font-mono">
            {t("upgradeBankRib")}: <span dir="ltr">{bankDetails.bankRib}</span>
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            {t("upgradeBankHolder")}: {bankDetails.bankAccountHolder}
          </p>
          <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            {t("upgradeReferenceLabel")}
            <input
              type="text"
              required
              minLength={2}
              maxLength={80}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder={t("upgradeReferencePlaceholder")}
              className="flex-1 rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 px-2 py-1 text-sm text-slate-900"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {t("upgradeSubmit")}
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
        {t("upgradeCancel")}
      </button>
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
