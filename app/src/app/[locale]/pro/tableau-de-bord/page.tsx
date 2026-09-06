import { getLocale, getTranslations } from "next-intl/server";
import { redirect, Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { canManageCollaborators, canManageProListings, canViewProDashboard } from "@/lib/pro-account";
import { parseProPermissions, type ProPermissions } from "@/lib/pro-permissions";
import { ProCollaboratorsManager } from "@/components/ProCollaboratorsManager";
import { ProSubscriptionUpgrade } from "@/components/ProSubscriptionUpgrade";
import { hasAdvancedProTools, getSubscriptionStatus, priceForTier } from "@/lib/pro-subscription";
import { getPaymentSettings, isBankDetailsComplete } from "@/lib/payment-settings";
import type { ProSubscriptionTier } from "@prisma/client";

export default async function ProDashboardPage() {
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: "/connexion", locale });
    return null;
  }

  const t = await getTranslations("Pro");

  let account = user.professionalAccount;
  const isOwner = Boolean(account);
  let permissions: ProPermissions | null = null;

  if (!account) {
    const collaboration = await prisma.proCollaborator.findFirst({
      where: { userId: user.id },
      include: { professionalAccount: true },
    });
    if (collaboration) {
      account = collaboration.professionalAccount;
      permissions = parseProPermissions(collaboration.permissions);
    }
  }

  if (!account) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-slate-600 mb-4">{t("noAccountYet")}</p>
        <Link href="/devenir-professionnel" className="text-sm text-slate-900 underline">
          {t("becomeProLink")}
        </Link>
      </div>
    );
  }

  const access = { isOwner, permissions };
  if (!canViewProDashboard(access)) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-slate-600">{t("forbidden")}</p>
      </div>
    );
  }

  const [listingCount, viewsAgg, conversationCount, collaborators, subscriptionStatus, paymentSettings] =
    await Promise.all([
      prisma.listing.count({ where: { sellerId: account.userId, status: "PUBLIEE" } }),
      prisma.listing.aggregate({ where: { sellerId: account.userId }, _sum: { views: true } }),
      prisma.conversation.count({ where: { sellerId: account.userId } }),
      canManageCollaborators(access)
        ? prisma.proCollaborator.findMany({
            where: { professionalAccountId: account.id },
            include: { user: { include: { profile: true } } },
          })
        : Promise.resolve([]),
      getSubscriptionStatus(account.userId),
      getPaymentSettings(),
    ]);

  // Lot 79 — palier supérieurs proposés à l'upgrade : tous les paliers payants
  // strictement au-dessus du palier actuel (pas seulement le suivant), un
  // compte Starter peut vouloir passer directement à Premium.
  const allTiers: ProSubscriptionTier[] = ["STARTER", "BUSINESS", "PRO", "PREMIUM"];
  const currentTier = subscriptionStatus?.tier ?? "STARTER";
  const currentTierIndex = allTiers.indexOf(currentTier);
  const upgradableTiers = allTiers.slice(currentTierIndex + 1) as Exclude<ProSubscriptionTier, "STARTER">[];
  const bankReady = isBankDetailsComplete(paymentSettings);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold text-slate-900">{account.nomCommercial}</h1>
        {account.badgeVerifie && <span className="text-emerald-700 text-sm">{t("verifiedBadge")}</span>}
      </div>

      <div className="grid grid-cols-3 gap-4 mt-6">
        <StatCard label={t("statListings")} value={listingCount} />
        <StatCard label={t("statViews")} value={viewsAgg._sum.views ?? 0} />
        <StatCard label={t("statConversations")} value={conversationCount} />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Link href={`/pro/${account.id}`} className="text-sm text-slate-700 underline hover:text-slate-900">
          {t("viewPublicShowcase")}
        </Link>
        {canManageProListings(access) && (
          <Link href="/compte/mes-annonces" className="text-sm text-slate-700 underline hover:text-slate-900">
            {t("manageListings")}
          </Link>
        )}
        {canManageProListings(access) && (
          <Link href="/pro/import" className="text-sm text-slate-700 underline hover:text-slate-900">
            {t("bulkImportLink")}
          </Link>
        )}
        {canManageProListings(access) && subscriptionStatus && hasAdvancedProTools(subscriptionStatus.tier) && (
          <a
            href={`/api/pro/accounts/${account.id}/export`}
            className="text-sm text-slate-700 underline hover:text-slate-900"
          >
            {t("exportLink")}
          </a>
        )}
      </div>

      {subscriptionStatus && (
        <div className="mt-8 rounded-lg border border-slate-200 p-4">
          <h2 className="text-sm font-medium text-slate-900 mb-1">{t("subscriptionTitle")}</h2>
          <p className="text-sm text-slate-700">
            {t("subscriptionCurrentTier", { tier: t(`subscriptionTier${subscriptionStatus.tier}`) })}
          </p>
          <p className="text-sm text-slate-500 mt-1">
            {subscriptionStatus.quota === null
              ? t("subscriptionQuotaUnlimited", { count: subscriptionStatus.activeListingCount })
              : t("subscriptionQuotaUsage", {
                  count: subscriptionStatus.activeListingCount,
                  quota: subscriptionStatus.quota,
                })}
          </p>
          {!hasAdvancedProTools(subscriptionStatus.tier) && (
            <p className="text-xs text-slate-400 mt-1">{t("subscriptionAdvancedToolsLocked")}</p>
          )}
          {isOwner && upgradableTiers.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {!bankReady ? (
                <p className="text-xs text-amber-700">{t("subscriptionBankDetailsMissing")}</p>
              ) : (
                upgradableTiers.map((tier) => (
                  <ProSubscriptionUpgrade
                    key={tier}
                    accountId={account.id}
                    targetTier={tier}
                    priceDzd={priceForTier(tier)}
                    bankDetails={{
                      bankName: paymentSettings.bankName ?? "",
                      bankRib: paymentSettings.bankRib ?? "",
                      bankAccountHolder: paymentSettings.bankAccountHolder ?? "",
                    }}
                  />
                ))
              )}
            </div>
          )}
        </div>
      )}

      {canManageCollaborators(access) && (
        <div className="mt-10">
          <ProCollaboratorsManager
            accountId={account.id}
            collaborators={collaborators.map((c) => ({
              id: c.id,
              permissions: parseProPermissions(c.permissions),
              name: c.user.profile?.displayName ?? c.user.email,
              email: c.user.email,
            }))}
          />
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-2xl font-semibold text-slate-900 mt-1">{value}</p>
    </div>
  );
}
