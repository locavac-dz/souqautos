"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { shouldRevokeVerifiedBadge } from "@/lib/pro-account";
import { PRO_CATEGORIES, type ProCategory } from "@/lib/validation/pro-account";
import { StructuredHoursEditor } from "@/components/StructuredHoursEditor";

type Initial = {
  nomCommercial: string;
  presentation: string | null;
  phone: string | null;
  website: string | null;
  categoryPro: ProCategory | null;
  horairesSemaine: string | null;
  wilayaId: number | null;
};

// Lot 106 — édition des informations de la boutique (nom, présentation,
// horaires, wilaya), jusque-là saisies une seule fois à la création.
export function ProProfileForm({
  accountId,
  initial,
  badgeVerifie,
  wilayas,
}: {
  accountId: string;
  initial: Initial;
  badgeVerifie: boolean;
  wilayas: { id: number; nomFr: string; nomAr: string }[];
}) {
  const t = useTranslations("Pro");
  const locale = useLocale();
  const router = useRouter();
  const [nomCommercial, setNomCommercial] = useState(initial.nomCommercial);
  const [presentation, setPresentation] = useState(initial.presentation ?? "");
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [website, setWebsite] = useState(initial.website ?? "");
  const [categoryPro, setCategoryPro] = useState<ProCategory | "">(initial.categoryPro ?? "");
  const [horairesSemaine, setHorairesSemaine] = useState<string | null>(initial.horairesSemaine);
  const [wilayaId, setWilayaId] = useState(initial.wilayaId ? String(initial.wilayaId) : "");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const nameChanged = shouldRevokeVerifiedBadge({
    badgeVerifie,
    currentName: initial.nomCommercial,
    nextName: nomCommercial,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setMessage(null);

    const res = await fetch(`/api/pro/accounts/${accountId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nomCommercial: nomCommercial.trim(),
        presentation: presentation.trim() || undefined,
        phone: phone.trim() || undefined,
        website: website.trim() || undefined,
        categoryPro: categoryPro || null,
        horairesSemaine,
        wilayaId: wilayaId ? Number(wilayaId) : null,
      }),
    });

    setPending(false);

    if (res.ok) {
      const body = await res.json();
      setMessage({ kind: "ok", text: body.badgeRevoked ? t("profileBadgeRevoked") : t("profileSaved") });
      router.refresh();
      return;
    }

    setMessage({ kind: "error", text: t("errorGeneric") });
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 space-y-4">
      <h2 className="text-sm font-medium text-slate-900 dark:text-slate-100">{t("profileSectionTitle")}</h2>
      <label className="block">
        <span className="text-sm text-slate-700 dark:text-slate-300">{t("nomCommercialLabel")}</span>
        <input
          type="text"
          value={nomCommercial}
          onChange={(e) => setNomCommercial(e.target.value)}
          required
          minLength={2}
          maxLength={100}
          className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 px-3 py-2 text-sm"
        />
      </label>
      {nameChanged && <p className="text-xs text-amber-700">{t("profileBadgeWarning")}</p>}
      <label className="block">
        <span className="text-sm text-slate-700 dark:text-slate-300">{t("presentationLabel")}</span>
        <textarea
          value={presentation}
          onChange={(e) => setPresentation(e.target.value)}
          maxLength={2000}
          rows={4}
          className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 px-3 py-2 text-sm"
        />
      </label>
      <div className="block">
        <span className="text-sm text-slate-700 dark:text-slate-300">{t("horairesSemaineLabel")}</span>
        <div className="mt-2">
          <StructuredHoursEditor
            initialJson={initial.horairesSemaine}
            onChange={setHorairesSemaine}
          />
        </div>
      </div>
      <label className="block">
        <span className="text-sm text-slate-700 dark:text-slate-300">{t("categoryProLabel")}</span>
        <select
          value={categoryPro}
          onChange={(e) => setCategoryPro(e.target.value as ProCategory | "")}
          className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 px-3 py-2 text-sm"
        >
          <option value="">{t("categoryProPlaceholder")}</option>
          {PRO_CATEGORIES.map((c) => (
            <option key={c} value={c}>{t(`categoryPro_${c}`)}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-sm text-slate-700 dark:text-slate-300">{t("phoneLabel")}</span>
        <input
          type="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          maxLength={20}
          placeholder={t("phonePlaceholder")}
          className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 px-3 py-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="text-sm text-slate-700 dark:text-slate-300">{t("websiteLabel")}</span>
        <input
          type="url"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          maxLength={200}
          placeholder="https://…"
          className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 px-3 py-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="text-sm text-slate-700 dark:text-slate-300">{t("wilayaLabel")}</span>
        <select
          value={wilayaId}
          onChange={(e) => setWilayaId(e.target.value)}
          className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 px-3 py-2 text-sm"
        >
          <option value="">{t("wilayaPlaceholder")}</option>
          {wilayas.map((w) => (
            <option key={w.id} value={w.id}>
              {locale === "ar" ? w.nomAr : w.nomFr}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {pending ? t("profileSaving") : t("profileSave")}
        </button>
        {message && (
          <p className={message.kind === "ok" ? "text-sm text-emerald-700" : "text-sm text-red-600"}>{message.text}</p>
        )}
      </div>
    </form>
  );
}
