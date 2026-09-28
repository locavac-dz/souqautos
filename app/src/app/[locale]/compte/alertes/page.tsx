import { getLocale, getTranslations } from "next-intl/server";
import { redirect, Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { DeleteAlertButton } from "@/components/DeleteAlertButton";
import { formatNumber } from "@/lib/format";
import { PushToggle } from "@/components/PushToggle";

const FUEL_KEY: Record<string, string> = {
  ESSENCE: "fuelEssence",
  DIESEL: "fuelDiesel",
  GPL: "fuelGpl",
  HYBRIDE: "fuelHybride",
  ELECTRIQUE: "fuelElectrique",
};
const GEARBOX_KEY: Record<string, string> = { MANUELLE: "gearboxManuelle", AUTOMATIQUE: "gearboxAutomatique" };
const CONDITION_KEY: Record<string, string> = { NEUF: "conditionNeuf", OCCASION: "conditionOccasion" };

export default async function SearchAlertsPage() {
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: "/connexion", locale });
    return null;
  }

  const t = await getTranslations("Alerts");
  const tWizard = await getTranslations("Wizard");

  const [alerts, brands, wilayas] = await Promise.all([
    prisma.searchAlert.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
    prisma.brand.findMany({ include: { models: true } }),
    prisma.wilaya.findMany(),
  ]);

  const brandById = new Map(brands.map((b) => [b.id, b]));
  const wilayaById = new Map(wilayas.map((w) => [w.id, w]));

  function describeFilters(filtersJson: string): string {
    let filters: Record<string, string>;
    try {
      filters = JSON.parse(filtersJson);
    } catch {
      return "";
    }
    const parts: string[] = [];
    if (filters.q) parts.push(`« ${filters.q} »`);
    if (filters.brandId) {
      const brand = brandById.get(Number(filters.brandId));
      if (brand) {
        const model = filters.modelId ? brand.models.find((m) => m.id === Number(filters.modelId)) : null;
        parts.push(model ? `${brand.name} ${model.name}` : brand.name);
      }
    }
    if (filters.wilayaId) {
      const wilaya = wilayaById.get(Number(filters.wilayaId));
      if (wilaya) parts.push(locale === "ar" ? wilaya.nomAr : wilaya.nomFr);
    }
    if (filters.priceMin || filters.priceMax) {
      const min = filters.priceMin ? formatNumber(Number(filters.priceMin), locale) : "0";
      const max = filters.priceMax ? formatNumber(Number(filters.priceMax), locale) : "∞";
      parts.push(`${min} – ${max} DA`);
    }
    if (filters.yearMin || filters.yearMax) {
      parts.push(`${filters.yearMin ?? "…"} – ${filters.yearMax ?? "…"}`);
    }
    if (filters.fuelType) parts.push(tWizard(FUEL_KEY[filters.fuelType]));
    if (filters.gearbox) parts.push(tWizard(GEARBOX_KEY[filters.gearbox]));
    if (filters.condition) parts.push(tWizard(CONDITION_KEY[filters.condition]));
    return parts.join(" · ");
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-2">{t("title")}</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{t("subtitle")}</p>

      <PushToggle />

      {alerts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-500 dark:text-slate-400 mb-4">{t("empty")}</p>
          <Link
            href="/recherche"
            className="inline-block rounded-md bg-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            {t("browseSearch")}
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 dark:border-slate-700 p-4"
            >
              <div>
                <p className="font-medium text-slate-900 dark:text-slate-100">{alert.label}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{describeFilters(alert.filters)}</p>
              </div>
              <DeleteAlertButton alertId={alert.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
