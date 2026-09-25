"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { MAX_PROSPECT_NOTE_LENGTH, PROSPECT_STATUSES, type ProspectStatusValue } from "@/lib/prospects";

type Feedback = { kind: "ok" | "error"; text: string } | null;

// Lot 123 — statut et note privée d'un prospect. Le statut s'enregistre dès qu'on le change ; la
// note avec le bouton « Enregistrer » (jamais à chaque frappe).
export function ProspectEditor({
  conversationId,
  initialStatus,
  initialNote,
}: {
  conversationId: string;
  initialStatus: ProspectStatusValue;
  initialNote: string | null;
}) {
  const t = useTranslations("ProProspects");
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [note, setNote] = useState(initialNote ?? "");
  const [savedNote, setSavedNote] = useState(initialNote ?? "");
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  async function save(body: { status?: ProspectStatusValue; note?: string }): Promise<boolean> {
    setPending(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/pro/prospects/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setFeedback({ kind: "error", text: res.status === 429 ? t("errorRateLimited") : t("errorGeneric") });
        return false;
      }
      setFeedback({ kind: "ok", text: t("saved") });
      return true;
    } catch {
      setFeedback({ kind: "error", text: t("errorGeneric") });
      return false;
    } finally {
      setPending(false);
    }
  }

  async function changeStatus(next: ProspectStatusValue) {
    const previous = status;
    setStatus(next);
    if (await save({ status: next })) {
      router.refresh(); // met à jour les compteurs et l'ordre de la liste
    } else {
      setStatus(previous);
    }
  }

  async function saveNote() {
    if (await save({ note })) setSavedNote(note.trim());
  }

  const noteChanged = note.trim() !== savedNote;

  return (
    <div className="space-y-2">
      <label className="block text-xs text-slate-500 dark:text-slate-400">
        {t("statusLabel")}
        <select
          value={status}
          disabled={pending}
          onChange={(e) => changeStatus(e.target.value as ProspectStatusValue)}
          className="mt-1 block w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-slate-200 px-2 py-1.5 text-sm text-slate-900 disabled:opacity-60"
        >
          {PROSPECT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`status${s}` as "statusNOUVEAU")}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-xs text-slate-500 dark:text-slate-400">
        {t("noteLabel")}
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={MAX_PROSPECT_NOTE_LENGTH}
          rows={2}
          placeholder={t("notePlaceholder")}
          className="mt-1 block w-full rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 px-2 py-1.5 text-sm text-slate-900"
        />
      </label>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={saveNote}
          disabled={pending || !noteChanged}
          className="rounded-md bg-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-40"
        >
          {t("saveNote")}
        </button>
        {feedback && (
          <span role="status" className={`text-xs ${feedback.kind === "ok" ? "text-emerald-700" : "text-red-600"}`}>
            {feedback.text}
          </span>
        )}
      </div>
    </div>
  );
}
