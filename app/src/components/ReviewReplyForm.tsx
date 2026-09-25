"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

const ERROR_KEY: Record<string, string> = {
  reply_required: "replyErrorRequired",
  reply_too_long: "replyErrorTooLong",
};

export function ReviewReplyForm({
  reviewId,
  initialReply,
  canReply,
}: {
  reviewId: string;
  initialReply: string | null;
  canReply: boolean;
}) {
  const t = useTranslations("Review");
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [reply, setReply] = useState(initialReply ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const res = await fetch(`/api/reviews/${reviewId}/reply`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reply }),
    });

    setPending(false);
    if (res.ok) {
      setEditing(false);
      router.refresh();
      return;
    }
    const data = await res.json().catch(() => null);
    setError(t(ERROR_KEY[data?.error] ?? "replyErrorGeneric"));
  }

  async function handleDelete() {
    setPending(true);
    setError(null);
    const res = await fetch(`/api/reviews/${reviewId}/reply`, { method: "DELETE" });
    setPending(false);
    if (res.ok) {
      setReply("");
      router.refresh();
      return;
    }
    setError(t("replyErrorGeneric"));
  }

  if (!canReply && !initialReply) {
    return null;
  }

  if (!canReply && initialReply) {
    return (
      <div className="mt-2 rounded-md bg-slate-50 dark:bg-slate-800 px-3 py-2">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{t("replyLabel")}</p>
        <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5 whitespace-pre-wrap">{initialReply}</p>
      </div>
    );
  }

  if (editing) {
    return (
      <form onSubmit={handleSave} className="mt-2 space-y-2">
        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder={t("replyPlaceholder")}
          maxLength={1000}
          rows={2}
          className="w-full rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 px-2 py-1.5 text-sm text-slate-900"
        />
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {t("saveReplyAction")}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setReply(initialReply ?? "");
              setError(null);
            }}
            className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            {t("cancelReplyAction")}
          </button>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </form>
    );
  }

  return (
    <div className="mt-2">
      {initialReply ? (
        <div className="rounded-md bg-slate-50 dark:bg-slate-800 px-3 py-2">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{t("replyLabel")}</p>
          <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5 whitespace-pre-wrap">{initialReply}</p>
          <div className="mt-1 flex items-center gap-3">
            <button type="button" onClick={() => setEditing(true)} className="text-xs text-slate-500 dark:text-slate-400 underline hover:text-slate-700 dark:hover:text-slate-300">
              {t("editReplyAction")}
            </button>
            <button type="button" onClick={handleDelete} disabled={pending} className="text-xs text-red-600 hover:underline disabled:opacity-50">
              {t("deleteReplyAction")}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setEditing(true)} className="text-xs text-slate-500 dark:text-slate-400 underline hover:text-slate-700 dark:hover:text-slate-300">
          {t("replyAction")}
        </button>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
