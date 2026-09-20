"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";

// Lot 138 — seconde étape de la connexion : le code de l'application, ou un code de secours. La session n'existe pas encore :
// elle n'est créée par le serveur qu'après un code valable.
export function TwoFactorVerifyForm() {
  const t = useTranslations("TwoFactor");
  const router = useRouter();
  const [recovery, setRecovery] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const response = await fetch("/api/auth/two-factor/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    }).catch(() => null);
    setPending(false);

    if (response?.ok) {
      const data = (await response.json()) as { next?: string };
      router.replace(data.next ?? "/compte/tableau-de-bord");
      router.refresh();
      return;
    }
    const data = (await response?.json().catch(() => null)) as { error?: string; lockedUntil?: string } | null;
    if (data?.error === "no_pending") {
      setExpired(true);
      setError(t("verifyExpired"));
    } else if (data?.error === "invalid_code") setError(t("errorInvalidCode"));
    else if (data?.error === "rate_limited") setError(t("errorRateLimited"));
    else if (data?.error === "account_locked") {
      const minutes = data.lockedUntil ? Math.max(1, Math.ceil((new Date(data.lockedUntil).getTime() - Date.now()) / 60_000)) : 15;
      setError(t("verifyLocked", { minutes }));
    } else setError(t("errorGeneric"));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-slate-600">{recovery ? t("verifyRecoveryIntro") : t("verifyIntro")}</p>
      <div>
        <label htmlFor="two-factor-code" className="block text-sm font-medium text-slate-700 mb-1">
          {recovery ? t("recoveryLabel") : t("codeLabel")}
        </label>
        <input
          id="two-factor-code"
          key={recovery ? "recovery" : "app"}
          type="text"
          required
          autoFocus
          autoComplete="one-time-code"
          inputMode={recovery ? "text" : "numeric"}
          maxLength={recovery ? 20 : 8}
          spellCheck={false}
          dir="ltr"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono tracking-widest"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      {expired ? (
        <Link href="/connexion" className="block w-full rounded-md bg-slate-900 px-4 py-2.5 text-center font-medium text-white hover:bg-slate-700">
          {t("backToLogin")}
        </Link>
      ) : (
        <button type="submit" disabled={pending} className="w-full rounded-md bg-slate-900 px-4 py-2.5 font-medium text-white hover:bg-slate-700 disabled:opacity-60">
          {pending ? t("verifying") : t("verifyButton")}
        </button>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <button
          type="button"
          onClick={() => {
            setRecovery((value) => !value);
            setCode("");
            setError(null);
          }}
          className="text-slate-600 underline hover:text-slate-900"
        >
          {recovery ? t("useApp") : t("useRecovery")}
        </button>
        <Link href="/connexion" className="text-slate-600 underline hover:text-slate-900">
          {t("backToLogin")}
        </Link>
      </div>
    </form>
  );
}
