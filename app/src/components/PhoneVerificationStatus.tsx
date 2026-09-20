"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

export function PhoneVerificationStatus({ verified, hasPhone }: { verified: boolean; hasPhone: boolean }) {
  const t = useTranslations("Verification");
  const router = useRouter();
  const [step, setStep] = useState<"idle" | "sent">("idle");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSendCode() {
    setPending(true);
    setError(null);

    const res = await fetch("/api/auth/verify-phone/request", { method: "POST" });
    setPending(false);

    if (res.ok) {
      setStep("sent");
      return;
    }

    setError(t("errorGeneric"));
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const res = await fetch("/api/auth/verify-phone/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code.trim() }),
    });

    setPending(false);

    if (res.ok) {
      router.refresh();
      return;
    }

    const responseBody = await res.json().catch(() => null);
    setError(
      responseBody?.error === "expired"
        ? t("codeExpired")
        : responseBody?.error === "too_many_attempts"
          ? t("tooManyAttempts")
          : responseBody?.error === "invalid_code"
            ? t("invalidCode")
            : t("errorGeneric")
    );
  }

  if (verified) {
    return <p className="text-sm text-emerald-700">{t("phoneVerified")}</p>;
  }

  if (!hasPhone) {
    return <p className="text-sm text-slate-500">{t("noPhoneOnFile")}</p>;
  }

  return (
    <div>
      <p className="text-sm text-amber-700">{t("phoneNotVerified")}</p>
      {step === "idle" ? (
        <button
          type="button"
          onClick={handleSendCode}
          disabled={pending}
          className="mt-1 text-sm text-slate-700 underline hover:text-slate-900 disabled:opacity-50"
        >
          {t("sendVerificationCode")}
        </button>
      ) : (
        <form onSubmit={handleConfirm} className="mt-2 flex items-center gap-2">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={6}
            placeholder={t("codePlaceholder")}
            className="w-28 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {t("confirmCode")}
          </button>
        </form>
      )}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
