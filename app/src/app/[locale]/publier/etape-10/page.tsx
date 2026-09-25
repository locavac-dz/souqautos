"use client";

import { useTranslations } from "next-intl";
import { StepShell } from "@/components/wizard/StepShell";

export default function Step10Page() {
  const t = useTranslations("Wizard");

  return (
    <StepShell step={10} title={t("step10Title")} nextLabel={t("next")}>
      <div className="rounded-lg border-2 border-slate-900 dark:border-slate-100 p-4">
        <p className="font-medium text-slate-900 dark:text-slate-100">{t("formulaStandard")}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t("formulaStandardDesc")}</p>
      </div>

      <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 p-4">
        <div className="flex items-center justify-between">
          <p className="font-medium text-slate-800 dark:text-slate-100">{t("formulaPremium")}</p>
          <span className="text-xs rounded-full bg-slate-200 dark:bg-slate-700 px-2 py-0.5 text-slate-700 dark:text-slate-300">
            {t("formulaComingSoon")}
          </span>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300">{t("formulaPremiumDesc")}</p>
      </div>

      <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 p-4">
        <div className="flex items-center justify-between">
          <p className="font-medium text-slate-800 dark:text-slate-100">{t("formulaPremiumPlus")}</p>
          <span className="text-xs rounded-full bg-slate-200 dark:bg-slate-700 px-2 py-0.5 text-slate-700 dark:text-slate-300">
            {t("formulaComingSoon")}
          </span>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300">{t("formulaPremiumPlusDesc")}</p>
      </div>
    </StepShell>
  );
}
