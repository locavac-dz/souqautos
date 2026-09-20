"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

const REASONS = [
  { value: "CONTENU_INAPPROPRIE", key: "reasonInappropriate" },
  { value: "FRAUDE_SUSPECTEE", key: "reasonFake" },
  { value: "AUTRE", key: "reasonOther" },
] as const;

// Lot 116 — signalement d'un avis publié. Rejoint la file /admin/signalements ;
// l'avis reste en ligne tant que l'équipe n'a pas confirmé.
export function ReportOwnerReviewButton({ reviewId }: { reviewId: string }) {
  const t = useTranslations("OwnerReview");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>("CONTENU_INAPPROPRIE");
  const [comment, setComment] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function send() {
    setPending(true);
    setMessage(null);
    const res = await fetch(`/api/owner-reviews/${reviewId}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason, comment: comment.trim() || undefined }),
    });
    setPending(false);

    if (res.ok) {
      setMessage({ kind: "ok", text: t("reportSent") });
      setOpen(false);
      return;
    }
    const data = await res.json().catch(() => null);
    if (res.status === 401) setMessage({ kind: "error", text: t("reportLoginRequired") });
    else if (data?.error === "already_reported") setMessage({ kind: "error", text: t("reportAlready") });
    else if (data?.error === "validation") setMessage({ kind: "error", text: t("reportNeedsDetails") });
    else setMessage({ kind: "error", text: t("errorGeneric") });
  }

  return (
    <div className="mt-2 text-xs">
      {message && <p className={message.kind === "ok" ? "text-emerald-700" : "text-red-600"}>{message.text}</p>}
      {!open && !(message?.kind === "ok") && (
        <button type="button" onClick={() => setOpen(true)} className="text-slate-500 underline hover:text-slate-700">
          {t("report")}
        </button>
      )}
      {open && (
        <div className="mt-1 space-y-2 rounded-md border border-slate-200 p-2">
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            aria-label={t("reportReasonLabel")}
            className="w-full rounded border border-slate-300 bg-white px-2 py-1"
          >
            {REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {t(r.key)}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={500}
            placeholder={t("reportCommentPlaceholder")}
            aria-label={t("reportCommentPlaceholder")}
            className="w-full rounded border border-slate-300 px-2 py-1"
          />
          <div className="flex gap-3">
            <button type="button" onClick={send} disabled={pending} className="font-medium text-slate-800 underline disabled:opacity-50">
              {t("reportSend")}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="text-slate-500 underline">
              {t("reportCancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
