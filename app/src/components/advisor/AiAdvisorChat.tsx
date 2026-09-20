"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { resolveListingLabels } from "@/lib/site";

type Role = "user" | "assistant";

type AdvisorListing = {
  id: string;
  title: string;
  price: number;
  brand: { name: string } | null;
  model: { name: string } | null;
  brandFreeText: string | null;
  modelFreeText: string | null;
  wilaya: { nomFr: string; nomAr: string };
  photos: { path: string }[];
};

type ChatMessage = { role: Role; content: string; listings?: AdvisorListing[] };

// Plafond de tours côté client, sous le plafond de validation serveur (21
// messages, cf. src/app/api/listings/advisor-chat/route.ts) — protège
// l'acheteur d'une conversation interminable plutôt que de le laisser buter
// sur un 400 de validation sans explication.
const MAX_USER_TURNS = 10;

export function AiAdvisorChat() {
  const t = useTranslations("AiAdvisor");
  const locale = useLocale();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userTurnCount = messages.filter((m) => m.role === "user").length;
  const turnLimitReached = userTurnCount >= MAX_USER_TURNS;

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = input.trim();
    if (!content || pending || turnLimitReached) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setInput("");
    setPending(true);
    setError(null);

    const res = await fetch("/api/listings/advisor-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: nextMessages.map(({ role, content }) => ({ role, content })),
        locale,
      }),
    });

    setPending(false);

    if (res.status === 429) {
      setError(t("rateLimited"));
      return;
    }
    if (!res.ok) {
      setError(t("errorGeneric"));
      return;
    }

    const data = await res.json();
    setMessages((prev) => [...prev, { role: "assistant", content: data.message, listings: data.listings }]);
  }

  return (
    <div>
      <div className="space-y-4 mb-4">
        {messages.map((message, index) => (
          <div key={index} className={`max-w-[85%] ${message.role === "user" ? "ms-auto" : "me-auto"}`}>
            <div
              className={`rounded-lg px-3 py-2 text-sm ${
                message.role === "user" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-900"
              }`}
            >
              {message.content}
            </div>
            {message.listings && message.listings.length > 0 && (
              <div className="mt-2 grid sm:grid-cols-2 gap-2">
                {message.listings.map((listing) => (
                  <AdvisorListingCard key={listing.id} listing={listing} locale={locale} />
                ))}
              </div>
            )}
          </div>
        ))}
        {pending && <p className="text-sm text-slate-500">{t("pending")}</p>}
      </div>

      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      {turnLimitReached && <p className="text-sm text-slate-500 mb-2">{t("turnLimitReached")}</p>}

      <form onSubmit={sendMessage} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("inputPlaceholder")}
          disabled={pending || turnLimitReached}
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={pending || turnLimitReached || !input.trim()}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {t("sendButton")}
        </button>
      </form>
    </div>
  );
}

// Sous-composant client-safe (pas de getTranslations/FavoriteButton async) —
// n'a pas vocation à remplacer ListingCard, seulement à afficher assez pour
// que l'acheteur reconnaisse l'annonce et clique vers la vraie fiche (où se
// trouvent favoris/comparateur réels).
function AdvisorListingCard({ listing, locale }: { listing: AdvisorListing; locale: string }) {
  const { brandLabel, modelLabel, wilayaLabel } = resolveListingLabels(listing, locale);

  return (
    <Link
      href={`/annonce/${listing.id}`}
      className="flex gap-3 rounded-lg border border-slate-200 p-2 hover:border-slate-300"
    >
      {listing.photos[0] ? (
        <div className="relative h-16 w-24 shrink-0">
          <Image src={listing.photos[0].path} alt="" fill sizes="96px" className="rounded object-cover" />
        </div>
      ) : (
        <div className="h-16 w-24 rounded bg-slate-100 shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">{listing.title}</p>
        <p className="text-xs text-slate-500">
          {brandLabel} {modelLabel} · {wilayaLabel}
        </p>
        <p className="mt-0.5 text-xs font-medium text-slate-900">{listing.price.toLocaleString()} DA</p>
      </div>
    </Link>
  );
}
