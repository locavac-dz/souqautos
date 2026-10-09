"use client";

import { useLocale, useTranslations } from "next-intl";
import { formatNumber } from "@/lib/format";
import { PaymentUpgradePanel, type BankDetails } from "@/components/PaymentUpgradePanel";

type Formula = "PREMIUM" | "PREMIUM_PLUS";

// Lot 66 / 264 — passage d'une annonce en formule payante. Lot 269 : enveloppe mince autour de PaymentUpgradePanel
// (partagé avec les abonnements pro) ; seuls les libellés et l'adresse diffèrent.
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
  const locale = useLocale();
  const price = formula === "PREMIUM" ? premiumPriceDzd : premiumPlusPriceDzd;
  const amount = formatNumber(price, locale);

  return (
    <PaymentUpgradePanel
      endpoint={`/api/listings/${listingId}/upgrade-formula`}
      payload={{ formula }}
      priceDzd={price}
      bankDetails={bankDetails}
      onlinePayment={onlinePayment}
      openButtonClassName="text-xs text-slate-500 dark:text-slate-400 underline hover:text-slate-700 dark:hover:text-slate-200"
      labels={{
        open: formula === "PREMIUM" ? t("upgradeToPremium") : t("upgradeToPremiumPlus"),
        payOnlineTitle: t("payOnlineTitle", { amount }),
        payOnlineButton: t("payOnlineButton"),
        payOnlineHint: t("payOnlineHint"),
        payOrByTransfer: t("payOrByTransfer"),
        payOnlineError: t("payOnlineError"),
        instructions: t("upgradeInstructions", { amount }),
        bankName: t("upgradeBankName"),
        bankRib: t("upgradeBankRib"),
        bankHolder: t("upgradeBankHolder"),
        referenceLabel: t("upgradeReferenceLabel"),
        referencePlaceholder: t("upgradeReferencePlaceholder"),
        submit: t("upgradeSubmit"),
        cancel: t("upgradeCancel"),
        errorGeneric: t("upgradeErrorGeneric"),
      }}
    />
  );
}
