"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

type CallbackStatusValue = "NOUVEAU" | "RAPPELE" | "ANNULE";
const STATUSES: CallbackStatusValue[] = ["NOUVEAU", "RAPPELE", "ANNULE"];

export function CallbackEditor({
  requestId,
  initialStatus,
  initialNote,
}: {
  requestId: string;
  initialStatus: CallbackStatusValue;
  initialNote: string | null;
}) {
  const t = useTranslations("CallbackRequest");
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [note, setNote] = useState(initialNote ?? "");
  const [savedNote, setSavedNote] = useState(initialNote ?? "");
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function save(body: { status?: CallbackStatusValue; note?: string }) {
    setPending(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/callback-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setFeedback({ kind: "error", text: t("errorGeneric") });
        return false;
      }
      setFeedback({ kind: "ok", text: "✓" });
      return true;
    } catch {
      setFeedback({ kind: "error", text: t("errorGeneric") });
      return false;
    } finally {
      setPending(false);
    }
  }

  async function changeStatus(next: CallbackStatusValue) {
    const prev = status;
    setStatus(next);
    if (!(await save({ status: next }))) {
      setStatus(prev);
    } else {
      router.refresh();
    }
  }

  async function saveNote() {
    if (await save({ note })) setSavedNote(note.trim());
  }

  const noteChanged = note.trim() !== savedNote;

  return (
    <div className="space-y-2 mt-2">
      <label className="block text-xs text-slate-500">
        {t("statusLabel")}
        <select
          value={status}
          disabled={pending}
          onChange={(e) => changeStatus(e.target.value as CallbackStatusValue)}
          aria-label={t("statusLabel")}
          className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 disabled:opacity-60"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`status${s}` as "statusNOUVEAU")}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-xs text-slate-500">
        {t("noteLabel")}
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          rows={2}
          placeholder={t("notePlaceholder")}
          className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
        />
      </label>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={saveNote}
          disabled={pending || !noteChanged}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-40"
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
