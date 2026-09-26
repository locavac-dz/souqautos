"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

type Settings = { autoSuspendListingThreshold: number; autoSuspendUserThreshold: number };

export function ModerationSettingsForm({
  settings,
  canEdit,
}: {
  settings: Settings;
  canEdit: boolean;
}) {
  const t = useTranslations("AdminSettings");
  const router = useRouter();
  const [listingThreshold, setListingThreshold] = useState(String(settings.autoSuspendListingThreshold));
  const [userThreshold, setUserThreshold] = useState(String(settings.autoSuspendUserThreshold));
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
          className="w-32 rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
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
          className="w-32 rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
        />
      </label>

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

      {saved && <p role="status" className="text-sm text-emerald-700">{t("saved")}</p>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
