"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CONTACT_SUBJECTS } from "@/lib/validation/contact";

export function ContactForm() {
  const t = useTranslations("Contact");
  const locale = useLocale();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState<typeof CONTACT_SUBJECTS[number]>("general");
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [loading, setLoading] = useState(false);
  // Lot 273 — référence renvoyée par le serveur, citée dans l'accusé de réception et dans les échanges.
  const [reference, setReference] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, subject, message, honeypot, locale }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        setReference(typeof data?.reference === "string" ? data.reference : null);
      } else {
        const data = await res.json().catch(() => null);
        if (data?.error === "rate_limited") setError(t("errorRateLimit"));
        else if (data?.error === "validation") setError(t("errorValidation"));
        else setError(t("errorGeneric"));
      }
    } catch {
      setError(t("errorGeneric"));
    } finally {
      setLoading(false);
    }
  }

  if (reference) {
    return (
      <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950 p-6 text-center space-y-2">
        <p className="text-lg font-semibold text-emerald-800 dark:text-emerald-200">{t("successTitle")}</p>
        <p className="text-sm text-emerald-700 dark:text-emerald-300">{t("successBody")}</p>
        <p className="text-sm text-emerald-700 dark:text-emerald-300">
          {t("successReference")} <span className="font-mono font-semibold">{reference}</span>
        </p>
        <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80">{t("successAck", { email })}</p>
      </div>
    );
  }

  const fieldClass = "w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500";
  const labelClass = "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1";

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      {/* Honeypot — caché des humains, piège pour les bots */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="contact-hp">Ne pas remplir</label>
        <input id="contact-hp" type="text" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
      </div>

      <div>
        <label htmlFor="contact-name" className={labelClass}>{t("nameLabel")}</label>
        <input
          id="contact-name"
          type="text"
          autoComplete="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("namePlaceholder")}
          className={fieldClass}
        />
      </div>

      <div>
        <label htmlFor="contact-email" className={labelClass}>{t("emailLabel")}</label>
        <input
          id="contact-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={fieldClass}
        />
      </div>

      <div>
        <label htmlFor="contact-subject" className={labelClass}>{t("subjectLabel")}</label>
        <select
          id="contact-subject"
          required
          value={subject}
          onChange={(e) => setSubject(e.target.value as typeof CONTACT_SUBJECTS[number])}
          className={fieldClass}
        >
          {CONTACT_SUBJECTS.map((s) => (
            <option key={s} value={s}>{t(`subject_${s}`)}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="contact-message" className={labelClass}>{t("messageLabel")}</label>
        <textarea
          id="contact-message"
          required
          rows={6}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t("messagePlaceholder")}
          className={`${fieldClass} resize-y`}
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60 transition-colors"
      >
        {loading ? t("sending") : t("submit")}
      </button>
    </form>
  );
}
