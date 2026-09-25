"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

type Wilaya = { id: number; nomFr: string; nomAr: string };

export function RegisterForm({
  wilayas,
  locale,
}: {
  wilayas: Wilaya[];
  locale: string;
}) {
  const t = useTranslations("Auth");
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [wilayaId, setWilayaId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName,
        email,
        password,
        wilayaId: wilayaId ? Number(wilayaId) : undefined,
      }),
    });

    setPending(false);

    if (res.ok) {
      router.replace("/compte/tableau-de-bord");
      router.refresh();
      return;
    }

    const data = await res.json().catch(() => null);
    if (data?.error === "email_taken") setError(t("errorEmailTaken"));
    else if (data?.error === "validation") setError(t("errorValidation"));
    else setError(t("errorGeneric"));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="register-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          {t("displayName")}
        </label>
        <input
          id="register-name"
          type="text"
          required
          minLength={2}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="w-full rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 px-3 py-2"
        />
      </div>

      <div>
        <label htmlFor="register-email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          {t("email")}
        </label>
        <input
          id="register-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 px-3 py-2"
        />
      </div>

      <div>
        <label htmlFor="register-password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          {t("password")}
        </label>
        <input
          id="register-password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 px-3 py-2"
        />
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t("passwordHint")}</p>
      </div>

      <div>
        <label htmlFor="register-wilaya" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          {t("wilayaOptional")}
        </label>
        <select
          id="register-wilaya"
          value={wilayaId}
          onChange={(e) => setWilayaId(e.target.value)}
          className="w-full rounded-md border border-slate-300 dark:border-slate-600 px-3 py-2 bg-white dark:bg-slate-800 dark:text-slate-200"
        >
          <option value="">—</option>
          {wilayas.map((w) => (
            <option key={w.id} value={w.id}>
              {locale === "ar" ? w.nomAr : w.nomFr}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300 px-4 py-2.5 font-medium text-white hover:bg-slate-700 disabled:opacity-60"
      >
        {t("submitRegister")}
      </button>
    </form>
  );
}
