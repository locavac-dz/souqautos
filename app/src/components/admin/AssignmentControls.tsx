"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

// Lot 277 — « Pris en charge par X » + bouton Prendre en charge / Libérer, dans les files de modération.
export function AssignmentControls({
  kind,
  id,
  assignee,
  assignedAt,
  currentUserId,
  canRelease,
}: {
  kind: "listings" | "reports";
  id: string;
  assignee: { id: string; email: string } | null;
  assignedAt: string | null;
  currentUserId: string;
  canRelease: boolean;
}) {
  const t = useTranslations("Admin");
  const locale = useLocale();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "take" | "release") {
    setPending(true);
    setError(null);
    const res = await fetch(`/api/admin/${kind}/${id}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setPending(false);
    if (res.ok) {
      router.refresh();
      return;
    }
    setError(t("actionError"));
  }

  const date = assignedAt ? new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : "fr-DZ", { dateStyle: "medium", timeStyle: "short" }).format(new Date(assignedAt)) : "";
  const button = "rounded border border-slate-300 px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800";

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
      {assignee ? (
        <span className="rounded bg-sky-50 px-2 py-0.5 font-medium text-sky-800 dark:bg-sky-900/40 dark:text-sky-200">
          {assignee.id === currentUserId ? t("assignedToMe", { date }) : t("assignedTo", { email: assignee.email, date })}
        </span>
      ) : (
        <button type="button" onClick={() => act("take")} disabled={pending} className={button}>
          {t("assignTake")}
        </button>
      )}
      {assignee && (assignee.id === currentUserId || canRelease) && (
        <button type="button" onClick={() => act("release")} disabled={pending} className={button}>
          {t("assignRelease")}
        </button>
      )}
      {error && <span role="alert" className="text-red-600 dark:text-red-400">{error}</span>}
    </div>
  );
}
