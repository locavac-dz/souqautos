import { getTranslations } from "next-intl/server";
import { StepShell } from "@/components/wizard/StepShell";
import { DraftResumeNotice } from "@/components/wizard/DraftResumeNotice";

export default async function Step1Page() {
  const t = await getTranslations("Wizard");

  return (
    <StepShell step={1} title={t("step1Title")} nextLabel={t("next")}>
      <DraftResumeNotice />
      <p className="text-slate-600 dark:text-slate-300">{t("step1Body")}</p>
      <p className="text-sm text-slate-500">{t("step1ProNote")}</p>
    </StepShell>
  );
}
