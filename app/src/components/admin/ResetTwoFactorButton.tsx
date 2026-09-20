"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

// Lot 138 — récupération : réinitialise la double authentification d'un compte dont le titulaire a perdu son téléphone ET ses
// codes de secours. Réservé aux administrateurs (le serveur le vérifie) ; demande une confirmation, car cela retire une protection.
export function ResetTwoFactorButton({ userId }: { userId: string }) {
  const t = useTranslations("TwoFactor");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReset() {
    if (!window.confirm(t("adminResetConfirm"))) return;
    setPending(true);
    setError(null);
    const res = await fetch(`/api/admin/users/${userId}/two-factor/reset`, { method: "POST" }).catch(() => null);
    setPending(false);
    if (res?.ok) {
      router.refresh();
      return;
    }
    setError(t("errorGeneric"));
  }

  return (
    <div className="text-right">
      <button type="button" onClick={handleReset} disabled={pending} className="text-xs text-red-700 underline hover:text-red-900 disabled:opacity-50">
        {t("adminReset")}
      </button>
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
