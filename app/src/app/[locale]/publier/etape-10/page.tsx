"use client";

import { useTranslations } from "next-intl";
import { StepShell } from "@/components/wizard/StepShell";

export default function Step10Page() {
  const t = useTranslations("Wizard");

  return (
    <StepShell step={10} title={t("step10Title")} nextLabel={t("next")}>
      <div className="rounded-lg border-2 border-slate-900 p-4">
        <p className="font-medium text-slate-900">{t("formulaStandard")}</p>
        <p className="text-sm text-slate-500">{t("formulaStandardDesc")}</p>
      </div>

      <div className="rounded-lg border border-slate-200 p-4 opacity-60">
        <div className="flex items-center justify-between">
          <p className="font-medium text-slate-700">{t("formulaPremium")}</p>
          <span className="text-xs rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">
            {t("formulaComingSoon")}
          </span>
        </div>
        <p className="text-sm text-slate-500">{t("formulaPremiumDesc")}</p>
      </div>

      <div className="rounded-lg border border-slate-200 p-4 opacity-60">
        <div className="flex items-center justify-between">
          <p className="font-medium text-slate-700">{t("formulaPremiumPlus")}</p>
          <span className="text-xs rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">
            {t("formulaComingSoon")}
          </span>
        </div>
        <p className="text-sm text-slate-500">{t("formulaPremiumPlusDesc")}</p>
      </div>
    </StepShell>
  );
}
