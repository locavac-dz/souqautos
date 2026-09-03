"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { USER_REPORT_REASONS } from "@/lib/reports";

const REASON_KEY: Record<string, string> = {
  COMPORTEMENT_FRAUDULEUX: "reasonComportementFrauduleux",
  MESSAGES_ABUSIFS: "reasonMessagesAbusifs",
  USURPATION_IDENTITE: "reasonUsurpationIdentite",
  AUTRE: "reasonAutre",
};

export function ReportUserButton({
  userId,
  isLoggedIn,
  initialAlreadyReported,
}: {
  userId: string;
  isLoggedIn: boolean;
  initialAlreadyReported: boolean;
}) {
  const t = useTranslations("Report");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>(USER_REPORT_REASONS[0]);
  const [comment, setComment] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(initialAlreadyReported);

  function handleOpen() {
    if (!isLoggedIn) {
      router.push("/connexion");
      return;
    }
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const res = await fetch(`/api/users/${userId}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason, comment: comment.trim() || undefined }),
    });

    setPending(false);

    if (res.ok) {
      setDone(true);
      setOpen(false);
      return;
    }

    const responseBody = await res.json().catch(() => null);
    setError(
      responseBody?.error === "comment_required"
        ? t("commentRequired")
        : responseBody?.error === "already_reported"
          ? t("alreadyReportedUser")
          : responseBody?.error === "cannot_report_self"
            ? t("cannotReportSelf")
            : t("errorGeneric")
    );
  }

  if (done) {
    return <p className="text-xs text-slate-400">{t("alreadyReportedUser")}</p>;
  }

  if (!open) {
    return (
      <button type="button" onClick={handleOpen} className="text-xs text-slate-400 hover:text-red-600">
        {t("reportUser")}
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-md border border-slate-200 p-3 space-y-2">
      <label className="block">
        <span className="text-xs text-slate-500">{t("reasonLabel")}</span>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        >
          {USER_REPORT_REASONS.map((r) => (
            <option key={r} value={r}>
              {t(REASON_KEY[r])}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-xs text-slate-500">{t("commentLabel")}</span>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={500}
          rows={2}
          className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        />
      </label>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {t("submit")}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-slate-400 hover:text-slate-600">
          {t("cancel")}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
  );
}
