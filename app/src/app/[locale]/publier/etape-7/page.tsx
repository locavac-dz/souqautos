"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { StepShell } from "@/components/wizard/StepShell";
import { useWizard } from "@/components/wizard/WizardContext";

export default function Step7Page() {
  const t = useTranslations("Wizard");
  const { data, setData } = useWizard();
  const [error, setError] = useState<string | null>(null);

  function handleNext() {
    if (!data.title || data.title.trim().length < 10) {
      setError(t("errorValidation"));
      return false;
    }
    if (!data.description || data.description.trim().length < 30) {
      setError(t("errorValidation"));
      return false;
    }
    setError(null);
    return true;
  }

  return (
    <StepShell step={7} title={t("step7Title")} nextLabel={t("next")} onNext={handleNext}>
      <div>
        <label htmlFor="wizard-title" className="block text-sm font-medium text-slate-700 mb-1">
          {t("title")}
        </label>
        <input
          id="wizard-title"
          type="text"
          placeholder={t("titlePlaceholder")}
          value={data.title ?? ""}
          onChange={(e) => setData({ title: e.target.value })}
          maxLength={120}
          className="w-full rounded-md border border-slate-300 px-3 py-2"
        />
      </div>

      <div>
        <label htmlFor="wizard-description" className="block text-sm font-medium text-slate-700 mb-1">
          {t("description")}
        </label>
        <textarea
          id="wizard-description"
          placeholder={t("descriptionPlaceholder")}
          value={data.description ?? ""}
          onChange={(e) => setData({ description: e.target.value })}
          maxLength={5000}
          rows={6}
          className="w-full rounded-md border border-slate-300 px-3 py-2"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </StepShell>
  );
}
