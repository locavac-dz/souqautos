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
      {/* WhatsApp en premier : canal dominant en Algérie */}
      {whatsappEnabled && (
        <button
          type="button"
          onClick={openWhatsapp}
          disabled={pending !== null}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1ebe5d] disabled:opacity-60"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          {pending === "WHATSAPP" ? t("loading") : t("whatsapp")}
        </button>
      )}

      {/* Téléphone en secondaire */}
      {revealed ? (
        <a
          href={revealed.telUrl}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {t("call", { phone: revealed.phone })}
        </a>
      ) : (
        <button
          type="button"
          onClick={showPhone}
          disabled={pending !== null}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {pending === "TELEPHONE" ? t("loading") : t("showPhone")}
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
