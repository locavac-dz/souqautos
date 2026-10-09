import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { isModerator } from "@/lib/auth-server/roles";
import { formatNumber } from "@/lib/format";
import { buildProspectionLists, PROSPECT_EXPIRY_WINDOW_DAYS, PROSPECT_MIN_LISTINGS, type ParticulierProspect, type ProProspect } from "@/lib/prospection";

// Lot 274 — liste de prospection pour le commercial (MODERATEUR et plus) : générée à chaque ouverture depuis la base.
export const dynamic = "force-dynamic";

export default async function AdminProspectionPage() {
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user || !isModerator(user.role)) {
    redirect({ href: "/admin", locale });
    return null;
  }
  const t = await getTranslations("Admin");
  const lists = await buildProspectionLists(locale);
  const dateFormatter = new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : "fr-DZ", { dateStyle: "medium" });

  const th = "py-2 pr-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400";
  const td = "py-2 pr-4 align-top text-slate-700 dark:text-slate-300";
  const link = "text-emerald-700 hover:underline dark:text-emerald-400";

  const contactCells = (row: { email: string; phone: string | null; wilaya: string | null }) => (
    <>
      <td className={td}>
        <a href={`mailto:${row.email}`} className={link}>{row.email}</a>
      </td>
      <td className={`${td} whitespace-nowrap`}>{row.phone ? <a href={`tel:${row.phone}`} className={link}>{row.phone}</a> : "—"}</td>
      <td className={td}>{row.wilaya ?? "—"}</td>
    </>
  );

  const particuliersTable = (rows: ParticulierProspect[]) => (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="border-b border-slate-200 dark:border-slate-700">
          <th className={th}>{t("prospectionColName")}</th>
          <th className={th}>{t("prospectionColEmail")}</th>
          <th className={th}>{t("prospectionColPhone")}</th>
          <th className={th}>{t("prospectionColWilaya")}</th>
          <th className={th}>{t("prospectionColListings")}</th>
          <th className={th}>{t("prospectionColLastListing")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.userId} className="border-b border-slate-100 dark:border-slate-800">
            <td className={`${td} font-medium text-slate-900 dark:text-slate-100`}>{r.name}</td>
            {contactCells(r)}
            <td className={td}>{formatNumber(r.listingCount, locale)}</td>
            <td className={`${td} whitespace-nowrap`}>{r.lastListingAt ? dateFormatter.format(r.lastListingAt) : "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const prosTable = (rows: ProProspect[]) => (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="border-b border-slate-200 dark:border-slate-700">
          <th className={th}>{t("prospectionColName")}</th>
          <th className={th}>{t("prospectionColEmail")}</th>
          <th className={th}>{t("prospectionColPhone")}</th>
          <th className={th}>{t("prospectionColWilaya")}</th>
          <th className={th}>{t("prospectionColListings")}</th>
          <th className={th}>{t("prospectionColTier")}</th>
          <th className={th}>{t("prospectionColExpires")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.accountId} className="border-b border-slate-100 dark:border-slate-800">
            <td className={`${td} font-medium text-slate-900 dark:text-slate-100`}>
              {r.name}
              {r.badgeVerifie && <span className="ms-1 text-xs font-normal text-emerald-700 dark:text-emerald-400">✓</span>}
            </td>
            {contactCells(r)}
            <td className={td}>{formatNumber(r.listingCount, locale)}</td>
            <td className={td}>{r.tier}</td>
            <td className={`${td} whitespace-nowrap`}>{r.expiresAt ? dateFormatter.format(r.expiresAt) : "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const section = (title: string, count: number, body: React.ReactNode) => (
    <section>
      <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-3">
        {title} ({count})
      </h2>
      {count === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">{t("prospectionEmpty")}</p> : <div className="overflow-x-auto">{body}</div>}
    </section>
  );

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-2">{t("prospectionTitle")}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t("prospectionIntro")}</p>
      </div>
      {section(t("prospectionParticuliers", { min: PROSPECT_MIN_LISTINGS }), lists.particuliers.length, particuliersTable(lists.particuliers))}
      {section(t("prospectionProsExpiring", { days: PROSPECT_EXPIRY_WINDOW_DAYS }), lists.prosExpiring.length, prosTable(lists.prosExpiring))}
      {section(t("prospectionProsNoSub"), lists.prosWithoutSubscription.length, prosTable(lists.prosWithoutSubscription))}
    </div>
  );
}
