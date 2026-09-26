"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

export function EditProfileForm({
  wilayas,
  initialDisplayName,
  initialWilayaId,
  initialPhone,
  initialBio,
  initialWhatsappEnabled,
  phoneVerified,
}: {
  wilayas: { id: number; nomFr: string; nomAr: string }[];
  initialDisplayName: string;
  initialWilayaId: number | null;
  initialPhone: string | null;
  initialBio: string | null;
  initialWhatsappEnabled: boolean;
  phoneVerified: boolean;
}) {
  const t = useTranslations("ProfileEdit");
  const locale = useLocale();
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [wilayaId, setWilayaId] = useState(initialWilayaId ? String(initialWilayaId) : "");
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [bio, setBio] = useState(initialBio ?? "");
  const [whatsappEnabled, setWhatsappEnabled] = useState(initialWhatsappEnabled);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const phoneChanged = phone.trim() !== (initialPhone ?? "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);

    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: displayName.trim(),
        wilayaId: wilayaId ? Number(wilayaId) : undefined,
        phone: phone.trim() || undefined,
        bio: bio.trim() || undefined,
        whatsappEnabled: phone.trim() ? whatsappEnabled : false,
      }),
    });

    setPending(false);

    if (res.ok) {
      setSaved(true);
      router.refresh();
      return;
    }

    const body = await res.json().catch(() => null);
    setError(
      body?.error === "phone_taken"
        ? t("phoneTaken")
        : body?.error === "whatsapp_needs_phone"
          ? t("whatsappNeedsPhone")
          : t("errorGeneric")
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block">
        <span className="text-sm text-slate-700 dark:text-slate-300">{t("displayNameLabel")}</span>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
          minLength={2}
          maxLength={80}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"
        />
      </label>
      <label className="block">
        <span className="text-sm text-slate-700 dark:text-slate-300">{t("wilayaLabel")}</span>
        <select
          value={wilayaId}
          onChange={(e) => setWilayaId(e.target.value)}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"
        >
          <option value="">{t("wilayaPlaceholder")}</option>
          {wilayas.map((w) => (
            <option key={w.id} value={w.id}>
              {locale === "ar" ? w.nomAr : w.nomFr}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-sm text-slate-700 dark:text-slate-300">{t("phoneLabel")}</span>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder={t("phonePlaceholder")}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"
        />
        {phoneVerified && !phoneChanged && (
          <span className="mt-1 block text-xs text-emerald-700">{t("phoneCurrentlyVerified")}</span>
        )}
        {phoneVerified && phoneChanged && (
          <span className="mt-1 block text-xs text-amber-700">{t("phoneChangeWarning")}</span>
        )}
      </label>
      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={whatsappEnabled && phone.trim() !== ""}
          disabled={phone.trim() === ""}
          onChange={(e) => setWhatsappEnabled(e.target.checked)}
          className="mt-1"
        />
        <span className="text-sm text-slate-700 dark:text-slate-300">
          {t("whatsappLabel")}
          <span className="block text-xs text-slate-500 dark:text-slate-400">{t("whatsappHelp")}</span>
        </span>
      </label>
      <label className="block">
        <span className="text-sm text-slate-700 dark:text-slate-300">{t("bioLabel")}</span>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={500}
          rows={4}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
      >
        {t("submit")}
      </button>
      {saved && <p role="status" className="text-sm text-emerald-700">{t("saved")}</p>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
