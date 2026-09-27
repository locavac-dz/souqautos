"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

// Lot 138 — gestion de la double authentification sur la page « Sécurité du compte » : activation (code QR + code de
// confirmation), codes de secours (montrés une seule fois), nouveaux codes, désactivation.
type Status = { enabled: boolean; enabledAt: string | null; recoveryCodesRemaining: number };
type Qr = { size: number; path: string };
type Setup = { secret: string; qr: Qr };

const LOW_RECOVERY_CODES = 3;

export function TwoFactorPanel({ status, hasPassword }: { status: Status; hasPassword: boolean }) {
  const t = useTranslations("TwoFactor");
  const locale = useLocale();
  const router = useRouter();

  const [setup, setSetup] = useState<Setup | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<null | "start" | "confirm" | "regenerate" | "disable">(null);
  const [error, setError] = useState<string | null>(null);

  const message = (errorCode: string | undefined) => {
    if (errorCode === "invalid_code") return t("errorInvalidCode");
    if (errorCode === "invalid_password") return t("errorInvalidPassword");
    if (errorCode === "rate_limited") return t("errorRateLimited");
    if (errorCode === "no_pending") return t("errorExpired");
    return t("errorGeneric");
  };

  async function call(url: string, body?: unknown) {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }).catch(() => null);
    const data = (await response?.json().catch(() => null)) as Record<string, unknown> | null;
    return { ok: Boolean(response?.ok), data };
  }

  async function start(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy("start");
    const { ok, data } = await call("/api/account/two-factor/setup", hasPassword ? { password } : {});
    setBusy(null);
    if (!ok || !data) return setError(message(data?.error as string | undefined));
    setSetup({ secret: data.secret as string, qr: data.qr as Qr });
    setCode("");
    setPassword("");
  }

  async function confirm(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy("confirm");
    const { ok, data } = await call("/api/account/two-factor/enable", { code });
    setBusy(null);
    if (!ok || !data) return setError(message(data?.error as string | undefined));
    setSetup(null);
    setCode("");
    setRecoveryCodes(data.recoveryCodes as string[]);
  }

  async function regenerate(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy("regenerate");
    const { ok, data } = await call("/api/account/two-factor/recovery-codes", { code });
    setBusy(null);
    if (!ok || !data) return setError(message(data?.error as string | undefined));
    setCode("");
    setRecoveryCodes(data.recoveryCodes as string[]);
  }

  async function disable(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy("disable");
    const { ok, data } = await call("/api/account/two-factor/disable", { code, ...(hasPassword ? { password } : {}) });
    setBusy(null);
    if (!ok || !data) return setError(message(data?.error as string | undefined));
    setCode("");
    setPassword("");
    router.refresh();
  }

  async function copyCodes() {
    try {
      await navigator.clipboard.writeText((recoveryCodes ?? []).join("\n"));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const codeField = (id: string, label: string) => (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
        {label}
      </label>
      <input
        id={id}
        type="text"
        required
        autoComplete="one-time-code"
        spellCheck={false}
        dir="ltr"
        maxLength={20}
        value={code}
        onChange={(event) => setCode(event.target.value)}
        className="w-full rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 px-3 py-2 font-mono tracking-widest"
      />
    </div>
  );
  const errorLine = error && (
    <p role="alert" className="text-sm text-red-600">
      {error}
    </p>
  );
  const primary = "rounded-md bg-slate-900 dark:bg-slate-100 px-4 py-2 text-sm font-medium text-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-slate-300 disabled:opacity-60";

  // --- Codes de secours, montrés UNE SEULE FOIS -------------------------------------------------------------------------------
  if (recoveryCodes) {
    return (
      <section aria-labelledby="recovery-title" className="space-y-4">
        <h2 id="recovery-title" className="text-lg font-medium text-slate-900 dark:text-slate-100">
          {t("recoveryTitle")}
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">{t("recoveryIntro")}</p>
        <ul data-testid="recovery-codes" dir="ltr" className="grid grid-cols-2 gap-2 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-4 font-mono text-sm text-slate-900 dark:text-slate-100">
          {recoveryCodes.map((recoveryCode) => (
            <li key={recoveryCode}>{recoveryCode}</li>
          ))}
        </ul>
        <button type="button" onClick={copyCodes} className="rounded-md border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 dark:bg-slate-900">
          {copied ? t("recoveryCopied") : t("recoveryCopy")}
        </button>
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input type="checkbox" checked={saved} onChange={(event) => setSaved(event.target.checked)} />
          <span>{t("recoverySaved")}</span>
        </label>
        <button
          type="button"
          disabled={!saved}
          onClick={() => {
            setRecoveryCodes(null);
            setSaved(false);
            setCopied(false);
            router.refresh();
          }}
          className={primary}
        >
          {t("done")}
        </button>
      </section>
    );
  }

  // --- Activation ---------------------------------------------------------------------------------------------------------------
  if (!status.enabled) {
    if (!setup) {
      return (
        <form onSubmit={start} className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">{t("intro")}</p>
          {hasPassword && (
            <div>
              <label htmlFor="two-factor-setup-password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t("passwordLabel")}
              </label>
              <input
                id="two-factor-setup-password"
                type="password"
                required
                autoComplete="current-password"
                dir={locale === "ar" ? "ltr" : undefined}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full max-w-sm rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 px-3 py-2"
              />
            </div>
          )}
          {errorLine}
          <button type="submit" disabled={busy === "start"} className={primary}>
            {busy === "start" ? t("starting") : t("enable")}
          </button>
        </form>
      );
    }
    return (
      <form onSubmit={confirm} className="space-y-4">
        <p className="text-sm text-slate-700 dark:text-slate-300">{t("setupStep1")}</p>
        <svg viewBox={`0 0 ${setup.qr.size} ${setup.qr.size}`} role="img" aria-label={t("qrAlt")} className="h-48 w-48 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <rect width={setup.qr.size} height={setup.qr.size} fill="#ffffff" />
          <path d={setup.qr.path} fill="#000000" shapeRendering="crispEdges" />
        </svg>
        <div className="text-sm text-slate-600 dark:text-slate-300">
          <p>{t("setupNoScan")}</p>
          <p data-testid="two-factor-secret" dir="ltr" className="mt-1 select-all font-mono text-base tracking-wider text-slate-900 dark:text-slate-100">
            {setup.secret}
          </p>
        </div>
        <p className="text-sm text-slate-700 dark:text-slate-300">{t("setupStep2")}</p>
        {codeField("two-factor-enable-code", t("codeLabel"))}
        {errorLine}
        <div className="flex gap-3">
          <button type="submit" disabled={busy === "confirm"} className={primary}>
            {busy === "confirm" ? t("confirming") : t("confirm")}
          </button>
          <button
            type="button"
            onClick={() => {
              setSetup(null);
              setError(null);
            }}
            className="rounded-md border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 dark:bg-slate-900"
          >
            {t("cancel")}
          </button>
        </div>
      </form>
    );
  }

  // --- Activée : nouveaux codes, désactivation -----------------------------------------------------------------------------------
  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-slate-700 dark:text-slate-300">
          {t("recoveryRemaining", { count: status.recoveryCodesRemaining })}
          {status.recoveryCodesRemaining <= LOW_RECOVERY_CODES && <span className="block text-amber-700">{t("recoveryLow")}</span>}
        </p>
      </div>

      <form onSubmit={regenerate} className="space-y-3">
        <h2 className="text-base font-medium text-slate-900 dark:text-slate-100">{t("regenerateTitle")}</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">{t("regenerateHelp")}</p>
        {codeField("two-factor-regenerate-code", t("codeLabel"))}
        {busy !== "disable" && errorLine}
        <button type="submit" disabled={busy === "regenerate"} className={primary}>
          {t("regenerate")}
        </button>
      </form>

      <form onSubmit={disable} className="space-y-3 border-t border-slate-200 dark:border-slate-700 pt-6">
        <h2 className="text-base font-medium text-slate-900 dark:text-slate-100">{t("disableTitle")}</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">{t("disableHelp")}</p>
        {hasPassword && (
          <div>
            <label htmlFor="two-factor-disable-password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t("passwordLabel")}
            </label>
            <input
              id="two-factor-disable-password"
              type="password"
              required
              autoComplete="current-password"
              dir={locale === "ar" ? "ltr" : undefined}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 px-3 py-2"
            />
          </div>
        )}
        {codeField("two-factor-disable-code", t("codeLabel"))}
        <button type="submit" disabled={busy === "disable"} className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60">
          {busy === "disable" ? t("disabling") : t("disable")}
        </button>
      </form>
    </div>
  );
}
