"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

export function EmailVerificationStatus({ verified }: { verified: boolean }) {
  const t = useTranslations("Verification");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRequest() {
    setPending(true);
    setError(null);

    const res = await fetch("/api/auth/verify-email/request", { method: "POST" });
    setPending(false);

    if (res.ok) {
      const body = await res.json();
      setSent(true);
      setPreviewUrl(body.previewUrl ?? null);
      router.refresh();
      return;
    }

    setError(t("errorGeneric"));
  }

  if (verified) {
    return <p className="text-sm text-emerald-700">{t("emailVerified")}</p>;
  }

  return (
    <div>
      <p className="text-sm text-amber-700">{t("emailNotVerified")}</p>
      {!sent ? (
        <button
          type="button"
          onClick={handleRequest}
          disabled={pending}
          className="mt-1 text-sm text-slate-700 dark:text-slate-300 underline hover:text-slate-900 dark:hover:text-slate-100 disabled:opacity-50"
        >
          {t("sendVerificationEmail")}
        </button>
      ) : (
        <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          <p>{t("emailSent")}</p>
          {previewUrl && (
            <a href={previewUrl} target="_blank" rel="noreferrer" className="text-slate-700 dark:text-slate-300 underline">
              {t("previewDevEmail")}
            </a>
          )}
        </div>
      )}
      {error && <p role="alert" className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
