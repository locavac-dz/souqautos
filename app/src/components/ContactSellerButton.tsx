"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

export function ContactSellerButton({
  listingId,
  isLoggedIn,
}: {
  listingId: string;
  isLoggedIn: boolean;
}) {
  const t = useTranslations("Messages");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (!isLoggedIn) {
      router.push("/connexion");
      return;
    }

    setPending(true);
    setError(null);
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId }),
    });
    setPending(false);

    if (res.ok) {
      const body = await res.json();
      router.push(`/compte/messages/${body.conversation.id}`);
      return;
    }

    const body = await res.json().catch(() => null);
    setError(
      body?.error === "cannot_message_self"
        ? t("cannotMessageSelf")
        : body?.error === "blocked"
          ? t("blockedNotice")
          : t("errorGeneric")
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="w-full rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        {t("contactSeller")}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
