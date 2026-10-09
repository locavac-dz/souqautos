"use client";

import { useLocale, useTranslations } from "next-intl";
import { formatNumber } from "@/lib/format";
import { PaymentUpgradePanel, type BankDetails } from "@/components/PaymentUpgradePanel";

type Tier = "BUSINESS" | "PRO" | "PREMIUM";

// Lot 79 / 264 — passage d'un compte pro à un palier payant. Lot 269 : enveloppe mince autour de
// PaymentUpgradePanel (partagé avec les formules d'annonce).
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
  const locale = useLocale();
  const tierLabel = t(`subscriptionTier${targetTier}`);
  const amount = formatNumber(priceDzd, locale);

  return (
    <PaymentUpgradePanel
      endpoint={`/api/pro/accounts/${accountId}/subscription/upgrade`}
      payload={{ tier: targetTier }}
      priceDzd={priceDzd}
      bankDetails={bankDetails}
      onlinePayment={onlinePayment}
      openButtonClassName="rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
      labels={{
        open: t("subscriptionUpgradeTo", { tier: tierLabel }),
        priceSuffix: `/${t("subscriptionPerMonth")}`,
        payOnlineTitle: t("subscriptionPayOnlineTitle", { tier: tierLabel, amount }),
        payOnlineButton: t("subscriptionPayOnlineButton"),
        payOnlineHint: t("subscriptionPayOnlineHint"),
        payOrByTransfer: t("subscriptionPayOrByTransfer"),
        payOnlineError: t("subscriptionPayOnlineError"),
        instructions: t("subscriptionUpgradeInstructions", { amount }),
        bankName: t("subscriptionUpgradeBankName"),
        bankRib: t("subscriptionUpgradeBankRib"),
        bankHolder: t("subscriptionUpgradeBankHolder"),
        referenceLabel: t("subscriptionUpgradeReferenceLabel"),
        referencePlaceholder: t("subscriptionUpgradeReferencePlaceholder"),
        submit: t("subscriptionUpgradeSubmit"),
        cancel: t("subscriptionUpgradeCancel"),
        errorGeneric: t("subscriptionUpgradeErrorGeneric"),
      }}
    />
  );
}
