"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

// Même gabarit que SuspendUserButton, sans formulaire de raison — un
// déverrouillage n'a pas besoin de justification (contrairement à une
// suspension), un seul clic suffit (Lot 102).
export function UnlockUserButton({ userId }: { userId: string }) {
  const t = useTranslations("Admin");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUnlock() {
    setPending(true);
    setError(null);
    const res = await fetch(`/api/admin/users/${userId}/unlock`, { method: "POST" });
    setPending(false);
    if (res.ok) {
      router.refresh();
      return;
    }
    setError(t("unlockErrorGeneric"));
  }

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={handleUnlock}
        disabled={pending}
        className="text-xs text-emerald-700 underline hover:text-emerald-900 disabled:opacity-50"
      >
        {t("unlockAction")}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
