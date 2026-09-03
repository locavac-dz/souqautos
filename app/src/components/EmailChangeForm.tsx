"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

const ERROR_KEY: Record<string, string> = {
  same_email: "emailChangeSameEmail",
  email_taken: "emailChangeTakenError",
  validation: "emailChangeErrorGeneric",
};

export function EmailChangeForm({ currentEmail }: { currentEmail: string }) {
  const t = useTranslations("ProfileEdit");
  const [newEmail, setNewEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSent(false);

    const res = await fetch("/api/profile/email-change/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newEmail: newEmail.trim() }),
    });

    setPending(false);

    if (res.ok) {
      setSent(true);
      setNewEmail("");
      return;
    }

    const data = await res.json().catch(() => null);
    setError(t(ERROR_KEY[data?.error] ?? "emailChangeErrorGeneric"));
  }

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <h2 className="text-sm font-medium text-slate-900 mb-1">{t("emailSectionTitle")}</h2>
      <p className="text-sm text-slate-500 mb-3">{t("currentEmailLabel", { email: currentEmail })}</p>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
        <label className="flex-1 min-w-[200px]">
          <span className="text-sm text-slate-700">{t("newEmailLabel")}</span>
          <input
            type="email"
            required
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={pending || !newEmail.trim()}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {t("changeEmailAction")}
        </button>
      </form>
      {sent && <p className="mt-2 text-sm text-emerald-700">{t("emailChangeRequestSent")}</p>}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
