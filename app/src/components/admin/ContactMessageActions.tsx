"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

// Lot 273 — actions sur un message de contact. La réponse au client part par courriel (lien « Répondre »),
// ici on ne fait que suivre l'état : pris en charge, répondu, rouvert.
export function ContactMessageActions({
  messageId,
  status,
  note: initialNote,
}: {
  messageId: string;
  status: "NOUVEAU" | "PRIS_EN_CHARGE" | "REPONDU";
  note: string | null;
}) {
  const t = useTranslations("Admin");
  const router = useRouter();
  const [note, setNote] = useState(initialNote ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "take" | "answered" | "reopen") {
    setPending(true);
    setError(null);
    const res = await fetch(`/api/admin/contact/${messageId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, note: note.trim() || undefined }),
    });
    setPending(false);
    if (res.ok) {
      router.refresh();
      return;
    }
    setError(t("actionError"));
  }

  const secondary =
    "rounded-md border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50";

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={t("resolutionNotePlaceholder")}
        className="w-full rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 px-3 py-1.5 text-sm"
      />
      <div className="flex flex-wrap gap-2">
        {status === "NOUVEAU" && (
          <button type="button" onClick={() => act("take")} disabled={pending} className={secondary}>
            {t("contactTake")}
          </button>
        )}
        {status !== "REPONDU" && (
          <button
            type="button"
            onClick={() => act("answered")}
            disabled={pending}
            className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            {t("contactAnswered")}
          </button>
        )}
        {status === "REPONDU" && (
          <button type="button" onClick={() => act("reopen")} disabled={pending} className={secondary}>
            {t("contactReopen")}
          </button>
        )}
      </div>
      {error && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
