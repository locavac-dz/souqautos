"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

// Lot 275 — envoi manuel du rapport de la dernière semaine complète (ADMIN).
export function SendWeeklyReportButton() {
  const t = useTranslations("Admin");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function send() {
    setPending(true);
    setMessage(null);
    const res = await fetch("/api/admin/reports/weekly", { method: "POST" });
    const data = await res.json().catch(() => null);
    setPending(false);
    if (res.ok && data?.status === "sent") {
      setMessage({ kind: "ok", text: t("weeklyReportSent", { count: data.recipients }) });
      router.refresh();
      return;
    }
    setMessage({ kind: "error", text: data?.status === "no_recipients" ? t("weeklyReportNoRecipients") : t("actionError") });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={send}
        disabled={pending}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
      >
        {pending ? t("weeklyReportSending") : t("weeklyReportSendNow")}
      </button>
      {message && (
        <p role={message.kind === "ok" ? "status" : "alert"} className={`text-sm ${message.kind === "ok" ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
