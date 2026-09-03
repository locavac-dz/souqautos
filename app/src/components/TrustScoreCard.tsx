import { getTranslations } from "next-intl/server";
import type { TrustScoreBreakdown } from "@/lib/trust-score";

export async function TrustScoreCard({
  breakdown,
  reviewCount,
  confirmedReportCount,
  accountAgeDays,
}: {
  breakdown: TrustScoreBreakdown;
  reviewCount: number;
  confirmedReportCount: number;
  accountAgeDays: number;
}) {
  const t = await getTranslations("TrustScore");
  const accountAgeMonths = Math.floor(accountAgeDays / 30);

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="flex items-baseline justify-between">
        <p className="font-medium text-slate-900">{t("title")}</p>
        <p className="text-2xl font-semibold text-slate-900">{t("scoreValue", { score: breakdown.score })}</p>
      </div>
      <p className="text-xs text-slate-500 mt-1">{t("disclaimer")}</p>

      <div className="mt-3 space-y-1.5 text-xs text-slate-600">
        <BreakdownRow
          label={t("signalEmail")}
          value={t("pointsEarned", { points: breakdown.emailPoints, max: 10 })}
        />
        <BreakdownRow
          label={t("signalPhone")}
          value={t("pointsEarned", { points: breakdown.phonePoints, max: 10 })}
        />
        <BreakdownRow
          label={t("signalIdentity")}
          value={t("pointsEarned", { points: breakdown.identityPoints, max: 20 })}
        />
        <BreakdownRow
          label={t("signalAge", { months: accountAgeMonths })}
          value={t("pointsEarned", { points: breakdown.agePoints, max: 15 })}
        />
        <BreakdownRow
          label={t("signalReviews")}
          value={
            reviewCount > 0
              ? t("pointsEarned", { points: breakdown.reviewPoints, max: 45 })
              : t("noReviewsNeutral")
          }
        />
        {confirmedReportCount > 0 && (
          <BreakdownRow
            label={t("signalReports", { count: confirmedReportCount })}
            value={t("penaltyApplied", { points: breakdown.reportPenalty })}
          />
        )}
      </div>
    </div>
  );
}

function BreakdownRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span>{label}</span>
      <span className="text-slate-900 font-medium shrink-0">{value}</span>
    </div>
  );
}
