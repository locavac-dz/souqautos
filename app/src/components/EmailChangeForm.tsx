"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

const ERROR_KEY: Record<string, string> = {
  same_email: "emailChangeSameEmail",
  email_taken: "emailChangeTakenError",
  invalid_password: "emailChangeInvalidPassword",
  validation: "emailChangeErrorGeneric",
};

export function EmailChangeForm({ currentEmail, hasPassword }: { currentEmail: string; hasPassword: boolean }) {
  const t = useTranslations("ProfileEdit");
  const locale = useLocale();
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
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
      body: JSON.stringify({ newEmail: newEmail.trim(), ...(hasPassword ? { password } : {}) }),
    });

    setPending(false);

    if (res.ok) {
      setSent(true);
      setNewEmail("");
      setPassword("");
      return;
    }

    const data = await res.json().catch(() => null);
    setError(t(ERROR_KEY[data?.error] ?? "emailChangeErrorGeneric"));
  }

  const inputClass = "mt-1 w-full rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 px-3 py-2 text-sm";

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
      <h2 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">{t("emailSectionTitle")}</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">{t("currentEmailLabel", { email: currentEmail })}</p>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
        <label className="flex-1 min-w-[200px]">
          <span className="text-sm text-slate-700 dark:text-slate-300">{t("newEmailLabel")}</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className={inputClass}
          />
        </label>
        {hasPassword && (
          <label className="flex-1 min-w-[200px]">
            <span className="text-sm text-slate-700 dark:text-slate-300">{t("emailChangePasswordLabel")}</span>
            <input
              id="email-change-password"
              type="password"
              required
              autoComplete="current-password"
              dir={locale === "ar" ? "ltr" : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </label>
        )}
        <button
          type="submit"
          disabled={pending || !newEmail.trim() || (hasPassword && !password)}
          className="rounded-md border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
        >
          {t("changeEmailAction")}
        </button>
      </form>
      {sent && <p role="status" className="mt-2 text-sm text-emerald-700">{t("emailChangeRequestSent")}</p>}
      {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
