"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

type Revealed = { phone: string; telUrl: string };

const ERROR_BY_STATUS: Record<number, string> = {
  429: "errorRateLimited",
  404: "errorUnavailable",
};

// Lot 119 — contact rapide depuis une annonce. Le numéro n'est PAS dans la page :
// il est demandé au serveur au clic (voir /api/listings/[id]/contact), qui limite
// le débit et compte les contacts.
export function ContactButtons({ listingId, whatsappEnabled }: { listingId: string; whatsappEnabled: boolean }) {
  const t = useTranslations("Contact");
  const locale = useLocale();
  const [revealed, setRevealed] = useState<Revealed | null>(null);
  const [pending, setPending] = useState<"TELEPHONE" | "WHATSAPP" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function request(channel: "TELEPHONE" | "WHATSAPP") {
    setError(null);
    setPending(channel);
    try {
      const res = await fetch(`/api/listings/${listingId}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, locale }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        setError(t(ERROR_BY_STATUS[res.status] ?? "errorGeneric"));
        return null;
      }
      return data as { phone?: string; telUrl?: string; whatsappUrl?: string };
    } catch {
      setError(t("errorGeneric"));
      return null;
    } finally {
      setPending(null);
    }
  }

  async function showPhone() {
    const data = await request("TELEPHONE");
    if (data?.phone && data.telUrl) setRevealed({ phone: data.phone, telUrl: data.telUrl });
  }

  async function openWhatsapp() {
    // La fenêtre est ouverte tout de suite, pendant le clic : la plupart des
    // navigateurs bloquent une ouverture faite après une attente réseau.
    const popup = window.open("about:blank", "_blank");
    if (popup) popup.opener = null;
    const data = await request("WHATSAPP");
    if (!data?.whatsappUrl) {
      popup?.close();
      return;
    }
    if (popup) popup.location.href = data.whatsappUrl;
    else window.location.href = data.whatsappUrl;
  }

  return (
    <div className="space-y-2">
      {revealed ? (
        <a
          href={revealed.telUrl}
          className="inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          {t("call", { phone: revealed.phone })}
        </a>
      ) : (
        <button
          type="button"
          onClick={showPhone}
          disabled={pending !== null}
          className="block rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
        >
          {pending === "TELEPHONE" ? t("loading") : t("showPhone")}
        </button>
      )}
      {whatsappEnabled && (
        <button
          type="button"
          onClick={openWhatsapp}
          disabled={pending !== null}
          className="block rounded-md border border-emerald-600 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
        >
          {pending === "WHATSAPP" ? t("loading") : t("whatsapp")}
        </button>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
