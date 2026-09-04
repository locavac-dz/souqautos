"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { WIZARD_STEPS, type WizardStepPath } from "./types";
import { useWizard } from "./WizardContext";

export function StepShell({
  step,
  title,
  children,
  onNext,
  nextLabel,
  nextDisabled,
  nextPending,
  hideNext,
}: {
  step: number; // 1-indexed
  title: string;
  children: React.ReactNode;
  onNext?: () => void | boolean;
  nextLabel: string;
  nextDisabled?: boolean;
  nextPending?: boolean;
  hideNext?: boolean;
}) {
  const t = useTranslations("Wizard");
  const router = useRouter();
  const { syncDraft } = useWizard();
  const total = WIZARD_STEPS.length;
  const prevPath: WizardStepPath | null = step > 1 ? WIZARD_STEPS[step - 2] : null;
  const nextPath: WizardStepPath | null = step < total ? WIZARD_STEPS[step] : null;

  function handleNext() {
    const proceed = onNext ? onNext() : true;
    if (proceed === false) return;
    // Lot 44 — checkpoint du brouillon serveur à chaque étape validée, jamais
    // à chaque frappe (cf. WizardContext.syncDraft).
    syncDraft();
    if (nextPath) router.push(`/publier/${nextPath}`);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8">
        <div className="h-1.5 w-full rounded-full bg-slate-100">
          <div
            className="h-1.5 rounded-full bg-slate-900 transition-all"
            style={{ width: `${(step / total) * 100}%` }}
          />
        </div>
        <p className="mt-2 text-xs font-medium text-slate-500">
          {step} / {total}
        </p>
      </div>

      <h1 className="text-2xl font-semibold text-slate-900 mb-6">{title}</h1>

      <div className="space-y-4">{children}</div>

      <div className="mt-8 flex justify-between">
        {prevPath ? (
          <button
            type="button"
            onClick={() => router.push(`/publier/${prevPath}`)}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            ← {t("previous")}
          </button>
        ) : (
          <span />
        )}

        {!hideNext && (
          <button
            type="button"
            onClick={handleNext}
            disabled={nextDisabled || nextPending}
            className="rounded-md bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {nextPending ? "…" : nextLabel}
          </button>
        )}
      </div>
    </div>
  );
}
