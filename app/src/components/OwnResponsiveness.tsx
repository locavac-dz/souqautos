import { getTranslations } from "next-intl/server";
import { responsivenessBadge, responsivenessGap, type Responsiveness } from "@/lib/seller-responsiveness";

// Lot 141 — la réactivité vue par le VENDEUR lui-même, dans son espace : ses chiffres réels, et ce qui lui manque pour obtenir
// le badge. Les acheteurs, eux, ne voient jamais de mauvaise note — seulement le badge quand il est mérité. Sans cet écran, un
// vendeur ne pourrait pas savoir pourquoi il ne l'a pas.
export async function OwnResponsiveness({ responsiveness }: { responsiveness: Responsiveness }) {
  const t = await getTranslations("SellerTrust");
  const badge = responsivenessBadge(responsiveness);
  const gap = responsivenessGap(responsiveness);
  const BADGE_KEY = { under1h: "badgeUnder1h", under2h: "badgeUnder2h", under6h: "badgeUnder6h", under24h: "badgeUnder24h" } as const;
  const GAP_KEY = { not_enough: "ownGapNotEnough", rate_too_low: "ownGapRateTooLow", too_slow: "ownGapTooSlow" } as const;

  // Un délai lisible : minutes sous l'heure, heures sous la journée, jours au-delà. Jamais « 0,8 heure ».
  const readableDelay = (minutes: number): string => {
    if (minutes < 60) return t("minutes", { count: Math.max(1, Math.round(minutes)) });
    if (minutes < 1440) return t("hours", { count: Math.round(minutes / 60) });
    return t("days", { count: Math.round(minutes / 1440) });
  };

  return (
    <section aria-labelledby="own-responsiveness-title" className="mt-6 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
      <h2 id="own-responsiveness-title" className="text-base font-medium text-slate-900 dark:text-slate-100">
        {t("ownTitle")}
      </h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t("ownIntro")}</p>
      <p className="mt-3 text-sm text-slate-900 dark:text-slate-100">
        {responsiveness.eligibleConversations === 0 || responsiveness.medianReplyMinutes === null
          ? t("ownNone")
          : t("ownStats", {
              responded: responsiveness.respondedConversations,
              eligible: responsiveness.eligibleConversations,
              median: readableDelay(responsiveness.medianReplyMinutes),
            })}
      </p>
      {badge ? (
        <p className="mt-2 text-sm font-medium text-emerald-800">{t("ownBadgeEarned", { badge: t(BADGE_KEY[badge]) })}</p>
      ) : (
        gap && <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{t(GAP_KEY[gap])}</p>
      )}
    </section>
  );
}
