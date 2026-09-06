"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

type Settings = {
  starterQuota: number;
  businessQuota: number;
  proQuota: number;
  businessPriceDzd: number;
  proPriceDzd: number;
  premiumPriceDzd: number;
};

// Lot 83 — même patron que PaymentSettingsForm (Lot 66) : formulaire admin
// simple, désactivé pour un lecteur non-admin (canEdit=false).
export function ProSubscriptionSettingsForm({ settings, canEdit }: { settings: Settings; canEdit: boolean }) {
  const t = useTranslations("AdminProSubscriptionSettings");
  const router = useRouter();
  const [starterQuota, setStarterQuota] = useState(String(settings.starterQuota));
  const [businessQuota, setBusinessQuota] = useState(String(settings.businessQuota));
  const [proQuota, setProQuota] = useState(String(settings.proQuota));
  const [businessPrice, setBusinessPrice] = useState(String(settings.businessPriceDzd));
  const [proPrice, setProPrice] = useState(String(settings.proPriceDzd));
  const [premiumPrice, setPremiumPrice] = useState(String(settings.premiumPriceDzd));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);

    const res = await fetch("/api/admin/pro-subscription-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        starterQuota: Number(starterQuota),
        businessQuota: Number(businessQuota),
        proQuota: Number(proQuota),
        businessPriceDzd: Number(businessPrice),
        proPriceDzd: Number(proPrice),
        premiumPriceDzd: Number(premiumPrice),
      }),
    });

    setPending(false);

    if (res.ok) {
      setSaved(true);
      router.refresh();
      return;
    }

    const body = await res.json().catch(() => null);
    setError(
      body?.error === "quotas_not_increasing"
        ? t("errorQuotasNotIncreasing")
        : body?.error === "prices_not_increasing"
          ? t("errorPricesNotIncreasing")
          : t("errorGeneric")
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-4">
      <p className="text-xs text-slate-500">{t("quotaHelp")}</p>

      <label className="block">
        <span className="text-sm font-medium text-slate-700">{t("starterQuotaLabel")}</span>
        <input
          type="number"
          min={1}
          max={100000}
          value={starterQuota}
          onChange={(e) => setStarterQuota(e.target.value)}
          disabled={!canEdit}
          className="mt-1 w-40 rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-400"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-slate-700">{t("businessQuotaLabel")}</span>
        <input
          type="number"
          min={1}
          max={100000}
          value={businessQuota}
          onChange={(e) => setBusinessQuota(e.target.value)}
          disabled={!canEdit}
          className="mt-1 w-40 rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-400"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-slate-700">{t("proQuotaLabel")}</span>
        <input
          type="number"
          min={1}
          max={100000}
          value={proQuota}
          onChange={(e) => setProQuota(e.target.value)}
          disabled={!canEdit}
          className="mt-1 w-40 rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-400"
        />
      </label>

      <p className="text-xs text-slate-400">{t("premiumUnlimitedNotice")}</p>

      <label className="block">
        <span className="text-sm font-medium text-slate-700">{t("businessPriceLabel")}</span>
        <input
          type="number"
          min={1}
          max={1000000}
          value={businessPrice}
          onChange={(e) => setBusinessPrice(e.target.value)}
          disabled={!canEdit}
          className="mt-1 w-40 rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-400"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-slate-700">{t("proPriceLabel")}</span>
        <input
          type="number"
          min={1}
          max={1000000}
          value={proPrice}
          onChange={(e) => setProPrice(e.target.value)}
          disabled={!canEdit}
          className="mt-1 w-40 rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-400"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-slate-700">{t("premiumPriceLabel")}</span>
        <input
          type="number"
          min={1}
          max={1000000}
          value={premiumPrice}
          onChange={(e) => setPremiumPrice(e.target.value)}
          disabled={!canEdit}
          className="mt-1 w-40 rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-400"
        />
      </label>

      {canEdit ? (
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {pending ? t("saving") : t("save")}
        </button>
      ) : (
        <p className="text-xs text-slate-500">{t("readOnlyNotice")}</p>
      )}

      {saved && <p className="text-sm text-emerald-700">{t("saved")}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
