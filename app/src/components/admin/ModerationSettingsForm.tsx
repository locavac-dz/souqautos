"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

type Settings = {
  autoSuspendListingThreshold: number;
  autoSuspendUserThreshold: number;
  autoPublishEnabled: boolean;
  autoPublishMinApprovedListings: number;
};

const INPUT_CLASS =
  "w-32 rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:disabled:bg-slate-700 dark:disabled:text-slate-400";

export function ModerationSettingsForm({
  settings,
  canEdit,
}: {
  settings: Settings;
  canEdit: boolean;
}) {
  const t = useTranslations("AdminSettings");
  const router = useRouter();
  const autoPublishId = useId();
  const [listingThreshold, setListingThreshold] = useState(String(settings.autoSuspendListingThreshold));
  const [userThreshold, setUserThreshold] = useState(String(settings.autoSuspendUserThreshold));
  const [autoPublishEnabled, setAutoPublishEnabled] = useState(settings.autoPublishEnabled);
  const [minApproved, setMinApproved] = useState(String(settings.autoPublishMinApprovedListings));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);

    const res = await fetch("/api/admin/moderation-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        autoSuspendListingThreshold: Number(listingThreshold),
        autoSuspendUserThreshold: Number(userThreshold),
        autoPublishEnabled,
        autoPublishMinApprovedListings: Number(minApproved),
      }),
    });

    setPending(false);

    if (res.ok) {
      setSaved(true);
      router.refresh();
      return;
    }

    setError(t("errorGeneric"));
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-4">
      <label className="block">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{t("autoSuspendListingLabel")}</span>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{t("autoSuspendListingHelp")}</p>
        <input
          type="number"
          min={1}
          max={50}
          value={listingThreshold}
          onChange={(e) => setListingThreshold(e.target.value)}
          disabled={!canEdit}
          className={INPUT_CLASS}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{t("autoSuspendUserLabel")}</span>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{t("autoSuspendUserHelp")}</p>
        <input
          type="number"
          min={1}
          max={50}
          value={userThreshold}
          onChange={(e) => setUserThreshold(e.target.value)}
          disabled={!canEdit}
          className={INPUT_CLASS}
        />
      </label>

      {/* Lot 272 — modération à deux vitesses. */}
      <fieldset className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 space-y-3">
        <legend className="px-1 text-sm font-medium text-slate-700 dark:text-slate-300">{t("autoPublishSection")}</legend>
        <div className="flex items-start gap-3">
          <input
            id={autoPublishId}
            type="checkbox"
            checked={autoPublishEnabled}
            onChange={(e) => setAutoPublishEnabled(e.target.checked)}
            disabled={!canEdit}
            className="mt-1 h-4 w-4"
          />
          <label htmlFor={autoPublishId} className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{t("autoPublishLabel")}</span>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t("autoPublishHelp")}</p>
          </label>
        </div>
        <label className="block">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{t("autoPublishMinLabel")}</span>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{t("autoPublishMinHelp")}</p>
          <input
            type="number"
            min={1}
            max={20}
            value={minApproved}
            onChange={(e) => setMinApproved(e.target.value)}
            disabled={!canEdit || !autoPublishEnabled}
            className={INPUT_CLASS}
          />
        </label>
      </fieldset>

      {canEdit ? (
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
        >
          {pending ? t("saving") : t("save")}
        </button>
      ) : (
        <p className="text-xs text-slate-500 dark:text-slate-400">{t("readOnlyNotice")}</p>
      )}

      {saved && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">{t("saved")}</p>}
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </form>
  );
}
