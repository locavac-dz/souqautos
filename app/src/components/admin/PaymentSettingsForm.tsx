"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

type Settings = {
  bankName: string | null;
  bankRib: string | null;
  bankAccountHolder: string | null;
  premiumPriceDzd: number;
  premiumPlusPriceDzd: number;
};

export function PaymentSettingsForm({ settings, canEdit }: { settings: Settings; canEdit: boolean }) {
  const t = useTranslations("AdminPaymentSettings");
  const router = useRouter();
  const [bankName, setBankName] = useState(settings.bankName ?? "");
  const [bankRib, setBankRib] = useState(settings.bankRib ?? "");
  const [bankAccountHolder, setBankAccountHolder] = useState(settings.bankAccountHolder ?? "");
  const [premiumPrice, setPremiumPrice] = useState(String(settings.premiumPriceDzd));
  const [premiumPlusPrice, setPremiumPlusPrice] = useState(String(settings.premiumPlusPriceDzd));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);

    const res = await fetch("/api/admin/payment-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bankName,
        bankRib,
        bankAccountHolder,
        premiumPriceDzd: Number(premiumPrice),
        premiumPlusPriceDzd: Number(premiumPlusPrice),
      }),
    });

    setPending(false);

    if (res.ok) {
      setSaved(true);
      router.refresh();
      return;
    }

    setError(t("errorGeneric"));
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-4">
      <label className="block">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{t("bankNameLabel")}</span>
        <input
          type="text"
          value={bankName}
          onChange={(e) => setBankName(e.target.value)}
          disabled={!canEdit}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{t("bankRibLabel")}</span>
        <input
          type="text"
          dir="ltr"
          value={bankRib}
          onChange={(e) => setBankRib(e.target.value)}
          disabled={!canEdit}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono text-left disabled:bg-slate-50 disabled:text-slate-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{t("bankAccountHolderLabel")}</span>
        <input
          type="text"
          value={bankAccountHolder}
          onChange={(e) => setBankAccountHolder(e.target.value)}
          disabled={!canEdit}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{t("premiumPriceLabel")}</span>
        <input
          type="number"
          min={1}
          max={1000000}
          value={premiumPrice}
          onChange={(e) => setPremiumPrice(e.target.value)}
          disabled={!canEdit}
          className="mt-1 w-40 rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{t("premiumPlusPriceLabel")}</span>
        <input
          type="number"
          min={1}
          max={1000000}
          value={premiumPlusPrice}
          onChange={(e) => setPremiumPlusPrice(e.target.value)}
          disabled={!canEdit}
          className="mt-1 w-40 rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
        />
      </label>

      {canEdit ? (
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
        >
          {pending ? t("saving") : t("save")}
        </button>
      ) : (
        <p className="text-xs text-slate-500 dark:text-slate-400">{t("readOnlyNotice")}</p>
      )}

      {saved && <p className="text-sm text-emerald-700">{t("saved")}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
