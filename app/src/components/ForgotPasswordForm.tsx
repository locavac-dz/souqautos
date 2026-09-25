"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

// Lot 133 — demande du lien « mot de passe oublié ». Après l'envoi, le même message s'affiche que le compte existe ou
// non : le formulaire ne trahit jamais l'existence d'une adresse.
export function ForgotPasswordForm() {
  const t = useTranslations("PasswordReset");
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setSent(true);
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error === "rate_limited" ? t("errorRateLimited") : data?.error === "validation" ? t("errorValidation") : t("errorGeneric"));
      }
    } catch {
      setError(t("errorGeneric"));
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
        {t("sent")}
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="forgot-email" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          {t("emailLabel")}
        </label>
        <input
          id="forgot-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 px-3 py-2"
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300 px-4 py-2.5 font-medium text-white hover:bg-slate-700 disabled:opacity-60"
      >
        {t("submitRequest")}
      </button>
    </form>
  );
}
