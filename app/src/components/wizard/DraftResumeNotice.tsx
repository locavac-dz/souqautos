"use client";

import { useTranslations } from "next-intl";
import { useWizard } from "./WizardContext";

// Lot 44 — affiché une seule fois, à l'entrée dans l'assistant, quand l'état
// initial vient d'un brouillon serveur plutôt que d'une session locale déjà
// active. Rappelle honnêtement la seule limitation du brouillon (les photos
// ne sont jamais persistées) plutôt que de la laisser l'utilisateur découvrir
// par surprise à l'étape 6.
export function DraftResumeNotice() {
  const t = useTranslations("Wizard");
  const { resumedFromServer, draftUpdatedAt, reset } = useWizard();

  if (!resumedFromServer) return null;

  const formatted = draftUpdatedAt
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(draftUpdatedAt)
      )
    : "";

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 flex items-start justify-between gap-3">
      <p>{formatted ? t("draftResumedWithDate", { date: formatted }) : t("draftResumed")}</p>
      <button
        type="button"
        onClick={() => reset()}
        className="shrink-0 text-xs text-slate-500 underline hover:text-slate-700"
      >
        {t("draftDiscard")}
      </button>
    </div>
  );
}
