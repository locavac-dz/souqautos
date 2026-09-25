"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { StepShell } from "@/components/wizard/StepShell";
import { useWizard } from "@/components/wizard/WizardContext";

export default function Step7Page() {
  const t = useTranslations("Wizard");
  const { data, setData } = useWizard();
  const [error, setError] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [suggestionSource, setSuggestionSource] = useState<"ai" | "heuristic" | null>(null);

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

  async function handleSuggest() {
    const brand = data.brandName ?? data.brandFreeText;
    if (!brand || !data.category || !data.year || data.mileage === undefined || !data.fuelType || !data.gearbox || !data.condition) {
      setSuggestError(t("suggestMissingData"));
      return;
    }

    setSuggesting(true);
    setSuggestError(null);
    setSuggestionSource(null);

    const res = await fetch("/api/listings/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: data.category,
        brand,
        model: data.modelName ?? data.modelFreeText,
        year: data.year,
        mileage: data.mileage,
        fuelType: data.fuelType,
        gearbox: data.gearbox,
        transmission: data.transmission,
        color: data.color,
        doors: data.doors,
        seats: data.seats,
        powerHp: data.powerHp,
        condition: data.condition,
        firstHand: data.firstHand,
        accidented: data.accidented,
        price: data.price,
      }),
    });

    setSuggesting(false);
    if (res.ok) {
      const suggestion = await res.json();
      setData({ title: suggestion.title, description: suggestion.description });
      setSuggestionSource(suggestion.source);
    } else {
      setSuggestError(t("suggestError"));
    }
  }

  return (
    <StepShell step={7} title={t("step7Title")} nextLabel={t("next")} onNext={handleNext}>
      <div>
        <button
          type="button"
          onClick={handleSuggest}
          disabled={suggesting}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {suggesting ? t("suggestPending") : t("suggestButton")}
        </button>
        {suggestionSource && (
          <p className="mt-1 text-xs text-slate-500">
            {suggestionSource === "ai" ? t("suggestSourceAi") : t("suggestSourceHeuristic")}
          </p>
        )}
        {suggestError && <p className="mt-1 text-xs text-red-600">{suggestError}</p>}
      </div>

      <div>
        <label htmlFor="wizard-title" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          {t("title")}
        </label>
        <input
          id="wizard-title"
          type="text"
          placeholder={t("titlePlaceholder")}
          value={data.title ?? ""}
          onChange={(e) => setData({ title: e.target.value })}
          maxLength={120}
          className="w-full rounded-md border border-slate-300 px-3 py-2 bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
        />
      </div>

      <div>
        <label htmlFor="wizard-description" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          {t("description")}
        </label>
        <textarea
          id="wizard-description"
          placeholder={t("descriptionPlaceholder")}
          value={data.description ?? ""}
          onChange={(e) => setData({ description: e.target.value })}
          maxLength={5000}
          rows={6}
          className="w-full rounded-md border border-slate-300 px-3 py-2 bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </StepShell>
  );
}
