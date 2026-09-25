"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { CONTACT_TEMPLATE_KEYS, type ContactTemplateKey } from "@/lib/contact-templates";

export function ContactSellerButton({
  listingId,
  listingTitle,
  isLoggedIn,
}: {
  listingId: string;
  listingTitle: string;
  isLoggedIn: boolean;
}) {
  const t = useTranslations("Messages");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ContactTemplateKey>(CONTACT_TEMPLATE_KEYS[0]);
  const [text, setText] = useState(() => t(`template_${CONTACT_TEMPLATE_KEYS[0]}_text`, { title: listingTitle }));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function selectTemplate(key: ContactTemplateKey) {
    setSelected(key);
    setText(t(`template_${key}_text`, { title: listingTitle }));
  }

  function handleOpen() {
    if (!isLoggedIn) {
      router.push("/connexion");
      return;
    }
    setOpen(true);
  }

  async function handleSend() {
    setPending(true);
    setError(null);
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId, initialMessage: text.trim() }),
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

  if (!open) {
    return (
      <div>
        <button
          type="button"
          onClick={handleOpen}
          className="w-full rounded-md border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          {t("contactSeller")}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 space-y-3">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t("templatePanelTitle")}</p>

      {/* Quick-select chips */}
      <div className="flex flex-wrap gap-2">
        {CONTACT_TEMPLATE_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => selectTemplate(key)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              selected === key
                ? "border-emerald-700 bg-emerald-700 text-white"
                : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:border-emerald-400 hover:text-emerald-700"
            }`}
          >
            {t(`template_${key}_label`)}
          </button>
        ))}
      </div>

      {/* Editable textarea */}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={500}
        rows={3}
        className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-slate-200 px-3 py-2 text-sm text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
      />

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={() => { setOpen(false); setError(null); }}
          className="rounded-md px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
        >
          {t("cancelMessage")}
        </button>
        <button
          type="button"
          onClick={handleSend}
          disabled={pending || text.trim().length === 0}
          className="rounded-md bg-emerald-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {pending ? "…" : t("sendMessage")}
        </button>
      </div>
    </div>
  );
}
