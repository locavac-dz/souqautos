import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { isAdmin } from "@/lib/auth-server/roles";
import { getModerationSettings } from "@/lib/moderation-settings";
import { getPaymentSettings } from "@/lib/payment-settings";
import { getProSubscriptionSettings } from "@/lib/pro-subscription-settings";
import { ModerationSettingsForm } from "@/components/admin/ModerationSettingsForm";
import { PaymentSettingsForm } from "@/components/admin/PaymentSettingsForm";
import { ProSubscriptionSettingsForm } from "@/components/admin/ProSubscriptionSettingsForm";

export default async function AdminSettingsPage() {
  const currentUser = await getCurrentUser();
  const t = await getTranslations("AdminSettings");
  const tPayment = await getTranslations("AdminPaymentSettings");
  const tProSubscription = await getTranslations("AdminProSubscriptionSettings");
  const settings = await getModerationSettings();
  const paymentSettings = await getPaymentSettings();
  const proSubscriptionSettings = await getProSubscriptionSettings();
  const canEdit = Boolean(currentUser && isAdmin(currentUser.role));

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-2">{t("title")}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{t("subtitle")}</p>
        <ModerationSettingsForm settings={settings} canEdit={canEdit} />
      </div>

      <div className="border-t border-slate-200 dark:border-slate-700 pt-8">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">{tPayment("title")}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{tPayment("subtitle")}</p>
        {canEdit ? (
          <PaymentSettingsForm settings={paymentSettings} canEdit={canEdit} />
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">{tPayment("restrictedNotice")}</p>
        )}
      </div>

      <div className="border-t border-slate-200 dark:border-slate-700 pt-8">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">{tProSubscription("title")}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{tProSubscription("subtitle")}</p>
        {canEdit ? (
          <ProSubscriptionSettingsForm settings={proSubscriptionSettings} canEdit={canEdit} />
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">{tProSubscription("restrictedNotice")}</p>
        )}
      </div>
    </div>
  );
}
