"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";

// Lot 133 — choix du nouveau mot de passe. Le jeton vient de l'adresse du lien (reçu par courriel) ; il n'est ni
// affiché, ni conservé dans le navigateur. Une fois le mot de passe changé, la personne est renvoyée vers la
// connexion : aucune session n'est ouverte automatiquement.
export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations("PasswordReset");
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError(t("errorMismatch"));
      return;
    }
    setPending(true);
    try {
      const res = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (res.ok) {
        router.replace("/connexion?reinitialise=1");
        return;
      }
      const data = await res.json().catch(() => null);
      if (data?.error === "invalid_token") setExpired(true);
      else setError(data?.error === "rate_limited" ? t("errorRateLimited") : data?.error === "validation" ? t("passwordHint") : t("errorGeneric"));
    } catch {
      setError(t("errorGeneric"));
    } finally {
      setPending(false);
    }
  }

  if (expired) {
    return (
      <div role="alert" className="space-y-3 text-sm">
        <p className="font-medium text-slate-900">{t("invalidLinkTitle")}</p>
        <p className="text-slate-600">{t("invalidLinkBody")}</p>
        <Link href="/mot-de-passe-oublie" className="text-slate-900 underline">
          {t("requestAnother")}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="reset-password" className="mb-1 block text-sm font-medium text-slate-700">
          {t("newPasswordLabel")}
        </label>
        <input
          id="reset-password"
          type="password"
          required
          minLength={8}
          maxLength={200}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2"
        />
        <p className="mt-1 text-xs text-slate-500">{t("passwordHint")}</p>
      </div>
      <div>
        <label htmlFor="reset-password-confirm" className="mb-1 block text-sm font-medium text-slate-700">
          {t("confirmPasswordLabel")}
        </label>
        <input
          id="reset-password-confirm"
          type="password"
          required
          minLength={8}
          maxLength={200}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2"
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
        className="w-full rounded-md bg-slate-900 px-4 py-2.5 font-medium text-white hover:bg-slate-700 disabled:opacity-60"
      >
        {t("submitReset")}
      </button>
    </form>
  );
}
