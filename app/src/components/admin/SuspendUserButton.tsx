"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

export function SuspendUserButton({
  userId,
  suspended,
}: {
  userId: string;
  suspended: boolean;
}) {
  const t = useTranslations("Admin");
  const router = useRouter();
  const [suspending, setSuspending] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUnsuspend() {
    setPending(true);
    setError(null);
    const res = await fetch(`/api/admin/users/${userId}/unsuspend`, { method: "POST" });
    setPending(false);
    if (res.ok) {
      router.refresh();
      return;
    }
    setError(t("suspendErrorGeneric"));
  }

  async function handleSuspend(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await fetch(`/api/admin/users/${userId}/suspend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    setPending(false);
    if (res.ok) {
      setSuspending(false);
      router.refresh();
      return;
    }
    setError(t("suspendErrorGeneric"));
  }

  if (suspended) {
    return (
      <div className="text-right">
        <button
          type="button"
          onClick={handleUnsuspend}
          disabled={pending}
          className="text-xs text-emerald-700 underline hover:text-emerald-900 disabled:opacity-50"
        >
          {t("unsuspendAction")}
        </button>
        {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  if (suspending) {
    return (
      <form onSubmit={handleSuspend} className="flex flex-col items-end gap-1">
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t("suspensionReasonPlaceholder")}
          className="w-48 rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 px-2 py-1 text-xs text-slate-900"
        />
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={pending || !reason.trim()}
            className="rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {t("confirmAction")}
          </button>
          <button
            type="button"
            onClick={() => {
              setSuspending(false);
              setReason("");
              setError(null);
            }}
            className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            {t("cancelActionSuspend")}
          </button>
        </div>
        {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      </form>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setSuspending(true)}
      className="text-xs text-red-600 underline hover:text-red-800"
    >
      {t("suspendAction")}
    </button>
  );
}
