"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

export function DeleteAccountForm() {
  const t = useTranslations("ProfileEdit");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const res = await fetch("/api/profile/delete-account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      setDone(true);
      setTimeout(() => {
        router.replace("/");
        router.refresh();
      }, 2000);
      return;
    }

    setPending(false);
    const body = await res.json().catch(() => null);
    setError(body?.error === "wrong_password" ? t("deleteAccountWrongPassword") : t("errorGeneric"));
  }

  if (done) {
    return (
      <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        {t("deleteAccountDone")}
      </div>
    );
  }

  return (
    <div className="rounded-md border border-red-200 bg-red-50 p-4">
      <h2 className="text-sm font-medium text-red-900">{t("deleteAccountTitle")}</h2>
      <p className="mt-1 text-xs text-red-700">{t("deleteAccountWarning")}</p>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
        >
          {t("deleteAccountAction")}
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="mt-3 space-y-2">
          <label className="block">
            <span className="text-xs text-red-700">{t("deleteAccountPasswordLabel")}</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-red-300 px-3 py-2 text-sm"
            />
          </label>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={pending || !password}
              className="rounded-md bg-red-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-800 disabled:opacity-50"
            >
              {pending ? t("deleteAccountPending") : t("deleteAccountConfirm")}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setPassword("");
                setError(null);
              }}
              className="text-xs text-red-700 hover:underline"
            >
              {t("cancel")}
            </button>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </form>
      )}
    </div>
  );
}
