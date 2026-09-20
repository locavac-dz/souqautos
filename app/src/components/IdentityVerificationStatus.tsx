"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

export function IdentityVerificationStatus({
  verified,
  pending,
  rejectionNote,
}: {
  verified: boolean;
  pending: boolean;
  rejectionNote: string | null;
}) {
  const t = useTranslations("Verification");
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setSubmitting(true);
    setError(null);

    const formData = new FormData();
    formData.append("document", file);

    const res = await fetch("/api/identity-verification/request", {
      method: "POST",
      body: formData,
    });

    setSubmitting(false);

    if (res.ok) {
      setSent(true);
      router.refresh();
      return;
    }

    const body = await res.json().catch(() => null);
    setError(
      body?.error === "document_invalid_type"
        ? t("identityDocInvalidType")
        : body?.error === "document_too_large"
          ? t("identityDocTooLarge")
          : t("errorGeneric")
    );
  }

  if (verified) {
    return <p className="text-sm text-emerald-700">{t("identityVerified")}</p>;
  }

  if (pending || sent) {
    return <p className="text-sm text-amber-700">{t("identityPending")}</p>;
  }

  return (
    <div>
      <p className="text-sm text-amber-700">{t("identityNotVerified")}</p>
      {rejectionNote && (
        <p className="text-xs text-red-600 mt-1">{t("identityRejected", { note: rejectionNote })}</p>
      )}
      <form onSubmit={handleSubmit} className="mt-2 space-y-2">
        <input
          type="file"
          aria-label={t("identityDocLabel")}
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-sm"
        />
        <button
          type="submit"
          disabled={submitting || !file}
          className="block rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {t("submitIdentityDoc")}
        </button>
      </form>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
