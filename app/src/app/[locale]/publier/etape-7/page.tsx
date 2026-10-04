"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { StepShell } from "@/components/wizard/StepShell";
import { useWizard } from "@/components/wizard/WizardContext";

type Suggestion = { title: string; description: string };

export default function Step7Page() {
  const t = useTranslations("Wizard");
  const { data, setData } = useWizard();
  const [error, setError] = useState<string | null>(null);

  // — Génération depuis zéro (existant) —
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [suggestionSource, setSuggestionSource] = useState<"ai" | "heuristic" | null>(null);

  // — Amélioration du texte existant (Lot 249) —
  const [improving, setImproving] = useState(false);
  const [improveError, setImproveError] = useState<string | null>(null);
  const [improved, setImproved] = useState<Suggestion | null>(null);

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
    setImproved(null);

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

  async function handleImprove() {
    if (!data.title || !data.description) return;
    setImproving(true);
    setImproveError(null);
    setImproved(null);

    const res = await fetch("/api/listings/improve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: data.title,
        description: data.description,
        brand: data.brandName ?? data.brandFreeText,
        model: data.modelName ?? data.modelFreeText,
        year: data.year,
        mileage: data.mileage,
        condition: data.condition,
      }),
    });

    setImproving(false);
    if (res.ok) {
      setImproved(await res.json());
    } else if (res.status === 503) {
      setImproveError(t("improveUnavailable"));
    } else {
      setImproveError(t("improveError"));
    }
  }

  function acceptImproved() {
    if (!improved) return;
    setData({ title: improved.title, description: improved.description });
    setImproved(null);
  }

  const canImprove =
    (data.title?.trim().length ?? 0) >= 10 && (data.description?.trim().length ?? 0) >= 30;

  return (
    <StepShell step={7} title={t("step7Title")} nextLabel={t("next")} onNext={handleNext} errorMessage={error}>
      {/* Boutons d'action IA */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleSuggest}
          disabled={suggesting || improving}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          {suggesting ? t("suggestPending") : t("suggestButton")}
        </button>

        {/* Lot 249 — amélioration du texte existant */}
        {canImprove && (
          <button
            type="button"
            onClick={handleImprove}
            disabled={suggesting || improving}
            className="rounded-md border border-teal-300 bg-teal-50 px-3 py-1.5 text-sm text-teal-700 hover:bg-teal-100 disabled:opacity-50 dark:border-teal-700 dark:bg-teal-950 dark:text-teal-300 dark:hover:bg-teal-900"
          >
            {improving ? t("improvePending") : t("improveButton")}
          </button>
        )}
      </div>

      {suggestionSource && !improved && (
        <p className="text-xs text-slate-500">
          {suggestionSource === "ai" ? t("suggestSourceAi") : t("suggestSourceHeuristic")}
        </p>
      )}
      {suggestError && <p className="text-xs text-red-600">{suggestError}</p>}
      {improveError && <p className="text-xs text-red-600">{improveError}</p>}

      {/* Lot 249 — carte de prévisualisation de l'amélioration */}
      {improved && (
        <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm dark:border-teal-800 dark:bg-teal-950">
          <p className="font-medium text-teal-800 dark:text-teal-200 mb-3">{t("improvePreviewTitle")}</p>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-0.5">{t("title")}</p>
          <p className="text-slate-800 dark:text-slate-200 mb-3">{improved.title}</p>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-0.5">{t("description")}</p>
          <p className="whitespace-pre-line text-slate-700 dark:text-slate-300 mb-4">{improved.description}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={acceptImproved}
              className="rounded-md bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700"
            >
              {t("improveAccept")}
            </button>
            <button
              type="button"
              onClick={() => setImproved(null)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700"
            >
              {t("improveDecline")}
            </button>
          </div>
        </div>
      )}

      <div>
        <label htmlFor="wizard-title" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          {t("title")}
        </label>
        <input
          id="wizard-title"
          type="text"
          placeholder={t("titlePlaceholder")}
          aria-invalid={error ? "true" : undefined}
          value={data.title ?? ""}
          onChange={(e) => { setData({ title: e.target.value }); setImproved(null); }}
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
          onChange={(e) => { setData({ description: e.target.value }); setImproved(null); }}
          maxLength={5000}
          rows={6}
          className="w-full rounded-md border border-slate-300 px-3 py-2 bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
        />
      </div>

    </StepShell>
  );
}
