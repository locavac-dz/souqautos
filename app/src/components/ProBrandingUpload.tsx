"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

const ERROR_KEY: Record<string, string> = {
  photo_too_large: "TooLarge",
  photo_invalid_type: "InvalidType",
  validation: "Generic",
};

type Kind = "logo" | "banner";

// Lot 103 — logo et bannière du compte pro partagent exactement le même
// flux (upload/suppression/erreurs), seuls le champ formData, l'endpoint,
// les clés i18n et le rendu (carré vs bandeau large) changent : un seul
// composant paramétré par `kind` plutôt que deux copies quasi identiques.
export function ProBrandingUpload({
  accountId,
  kind,
  initialUrl,
}: {
  accountId: string;
  kind: Kind;
  initialUrl: string | null;
}) {
  const t = useTranslations("Pro");
  const router = useRouter();
  const [url, setUrl] = useState(initialUrl);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const endpoint = `/api/pro/accounts/${accountId}/${kind}`;
  const titleKey = `${kind}SectionTitle`;
  const changeKey = `${kind}ChangeAction`;
  const removeKey = `${kind}RemoveAction`;
  const uploadingKey = `${kind}Uploading`;

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setPending(true);
    setError(null);

    const formData = new FormData();
    formData.append(kind, file);

    const res = await fetch(endpoint, { method: "POST", body: formData });
    setPending(false);

    if (res.ok) {
      const data = await res.json();
      setUrl(data[`${kind}Url`]);
      router.refresh();
      return;
    }

    const data = await res.json().catch(() => null);
    const suffix = ERROR_KEY[data?.error] ?? "Generic";
    setError(t(`${kind}Error${suffix}`));
  }

  async function handleRemove() {
    setPending(true);
    setError(null);
    const res = await fetch(endpoint, { method: "DELETE" });
    setPending(false);
    if (res.ok) {
      setUrl(null);
      router.refresh();
    }
  }

  const imageBox =
    kind === "logo" ? "relative h-16 w-16 shrink-0" : "relative h-20 w-40 shrink-0";
  const imageClass =
    kind === "logo"
      ? "rounded-full object-cover border border-slate-200 dark:border-slate-600"
      : "rounded-md object-cover border border-slate-200 dark:border-slate-600";
  const placeholderBox =
    kind === "logo"
      ? "h-16 w-16 shrink-0 rounded-full bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600"
      : "h-20 w-40 shrink-0 rounded-md bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600";

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
      <h2 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-3">{t(titleKey)}</h2>
      <div className="flex items-center gap-4">
        {url ? (
          <div className={imageBox}>
            <Image src={url} alt="" fill sizes="160px" className={imageClass} />
          </div>
        ) : (
          <div className={placeholderBox} />
        )}
        <div className="flex flex-col items-start gap-1">
          <label className="cursor-pointer text-sm text-slate-700 dark:text-slate-300 underline hover:text-slate-900 dark:hover:text-slate-100">
            {pending ? t(uploadingKey) : t(changeKey)}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleUpload}
              disabled={pending}
              className="hidden"
            />
          </label>
          {url && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={pending}
              className="text-xs text-red-600 hover:underline disabled:opacity-50"
            >
              {t(removeKey)}
            </button>
          )}
        </div>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
