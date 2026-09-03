import { getTranslations } from "next-intl/server";
import { StepShell } from "@/components/wizard/StepShell";

export default async function Step1Page() {
  const t = await getTranslations("Wizard");

  return (
    <StepShell step={1} title={t("step1Title")} nextLabel={t("next")}>
      <p className="text-slate-600">{t("step1Body")}</p>
      <p className="text-sm text-slate-400">{t("step1ProNote")}</p>
    </StepShell>
  );
}
