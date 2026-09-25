"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export function SaveSearchAlertForm({ filters }: { filters: Record<string, string | undefined> }) {
  const t = useTranslations("Alerts");
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<"idle" | "done" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setStatus("idle");

    const cleanFilters: Record<string, string> = {};
    for (const [key, value] of Object.entries(filters)) {
      if (value) cleanFilters[key] = value;
    }

    const res = await fetch("/api/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, filters: cleanFilters }),
    });

    setPending(false);
    if (res.ok) {
      setStatus("done");
      setLabel("");
      setOpen(false);
    } else {
      setStatus("error");
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm text-slate-700 dark:text-slate-300 underline hover:text-slate-900 dark:hover:text-slate-100"
      >
        {t("saveSearch")}
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-md border border-slate-200 dark:border-slate-700 p-3 space-y-2">
      <label htmlFor="alert-label" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
        {t("labelPlaceholder")}
      </label>
      <input
        id="alert-label"
        type="text"
        required
        minLength={2}
        maxLength={80}
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder={t("labelPlaceholder")}
        className="w-full rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 px-3 py-1.5 text-sm"
      />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {t("saveSearchAction")}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
        >
          {t("cancel")}
        </button>
      </div>
      {status === "done" && <p className="text-xs text-green-700">{t("saveSearchDone")}</p>}
      {status === "error" && <p className="text-xs text-red-600">{t("saveSearchError")}</p>}
    </form>
  );
}
