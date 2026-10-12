import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SITE_URL } from "@/lib/site";
import { localizedAlternates } from "@/lib/seo-alternates";
import { buildBreadcrumbJsonLd, safeJsonLdStringify } from "@/lib/structured-data";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { hasAdvancedProTools, priceForAnyTier, quotaForTier } from "@/lib/pro-subscription";
import { getProSubscriptionSettings } from "@/lib/pro-subscription-settings";
import type { ProSubscriptionTier } from "@prisma/client";
import { formatPrice } from "@/lib/format";

// Lot 80 — dernière page documentée au sitemap (docs/ARCHITECTURE.md §2 :
// "/professionnels Landing pro (abonnements)") jamais construite : le
// mécanisme d'abonnement lui-même existe depuis le Lot 79, mais aucune page
// publique ne le présentait avant un visiteur non connecté. Les chiffres
// affichés viennent directement de src/lib/pro-subscription.ts — jamais une
// copie recopiée à la main qui pourrait diverger du mécanisme réel.
const TIERS: ProSubscriptionTier[] = ["STARTER", "BUSINESS", "PRO", "PREMIUM"];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ProLanding" });
  const canonical = `${SITE_URL}/${locale}/professionnels`;

  return {
    title: `${t("title")} — Souq Autos`,
    description: t("subtitle"),
    alternates: localizedAlternates(canonical),
    openGraph: { title: t("title"), description: t("subtitle"), url: canonical, type: "website" },
  };
}

export default async function ProfessionalsLandingPage() {
  const locale = await getLocale();
  const t = await getTranslations("ProLanding");
  const subscriptionSettings = await getProSubscriptionSettings();

  const breadcrumbItems = [{ name: t("breadcrumbHome"), href: "/" }, { name: t("title") }];
  const jsonLd = buildBreadcrumbJsonLd([
    { name: t("breadcrumbHome"), url: `${SITE_URL}/${locale}` },
    { name: t("title"), url: `${SITE_URL}/${locale}/professionnels` },
  ]);

  const features = [
    "featureShowcase",
    "featureBulkImport",
    "featureExport",
    "featureAutoRenew",
    "featureCollaborators",
    "featureStats",
    "featureVerifiedBadge",
    "featureReviews",
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }} />

      <Breadcrumbs items={breadcrumbItems} />

      <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">{t("title")}</h1>
      <p className="mt-2 text-base text-slate-600 dark:text-slate-300 max-w-2xl">{t("subtitle")}</p>

      <div className="mt-10">
        <Link
          href="/devenir-professionnel"
          className="inline-block rounded-md bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
        >
          {t("cta")}
        </Link>
      </div>

      <h2 className="mt-14 text-lg font-medium text-slate-900 dark:text-slate-100">{t("featuresTitle")}</h2>
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {features.map((key) => (
          <div key={key} className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
            <p className="text-sm text-slate-700 dark:text-slate-300">{t(key)}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-14 text-lg font-medium text-slate-900 dark:text-slate-100">{t("pricingTitle")}</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t("pricingSubtitle")}</p>
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {TIERS.map((tier) => {
          const quota = quotaForTier(tier, subscriptionSettings);
          const price = priceForAnyTier(tier, subscriptionSettings);
          return (
            <div key={tier} className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 flex flex-col">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t(`tier${tier}`)}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                {price === null ? t("pricingFree") : formatPrice(price, locale)}
                {price !== null && <span className="text-sm font-normal text-slate-500 dark:text-slate-400">/{t("pricingPerMonth")}</span>}
              </p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                {quota === null ? t("pricingQuotaUnlimited") : t("pricingQuotaLimited", { quota })}
              </p>
              {hasAdvancedProTools(tier) && (
                <p className="mt-1 text-xs text-emerald-700">{t("pricingAdvancedToolsIncluded")}</p>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">{t("pricingFootnote")}</p>
    </div>
  );
}
