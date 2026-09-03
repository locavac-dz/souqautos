"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

const ERROR_KEY: Record<string, string> = {
  photo_too_large: "avatarErrorTooLarge",
  photo_invalid_type: "avatarErrorInvalidType",
  validation: "avatarErrorGeneric",
};

export function AvatarUpload({ initialAvatarUrl }: { initialAvatarUrl: string | null }) {
  const t = useTranslations("ProfileEdit");
  const router = useRouter();
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setPending(true);
    setError(null);

    const formData = new FormData();
    formData.append("avatar", file);

    const res = await fetch("/api/profile/avatar", { method: "POST", body: formData });
    setPending(false);

    if (res.ok) {
      const data = await res.json();
      setAvatarUrl(data.avatarUrl);
      router.refresh();
      return;
    }

    const data = await res.json().catch(() => null);
    setError(t(ERROR_KEY[data?.error] ?? "avatarErrorGeneric"));
  }

  async function handleRemove() {
    setPending(true);
    setError(null);
    const res = await fetch("/api/profile/avatar", { method: "DELETE" });
    setPending(false);
    if (res.ok) {
      setAvatarUrl(null);
      router.refresh();
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <h2 className="text-sm font-medium text-slate-900 mb-3">{t("avatarSectionTitle")}</h2>
      <div className="flex items-center gap-4">
        {avatarUrl ? (
          <div className="relative h-16 w-16 shrink-0">
            <Image
              src={avatarUrl}
              alt=""
              fill
              sizes="64px"
              className="rounded-full object-cover border border-slate-200"
            />
          </div>
        ) : (
          <div className="h-16 w-16 shrink-0 rounded-full bg-slate-100 border border-slate-200" />
        )}
        <div className="flex flex-col items-start gap-1">
          <label className="cursor-pointer text-sm text-slate-700 underline hover:text-slate-900">
            {pending ? t("avatarUploading") : t("avatarChangeAction")}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleUpload}
              disabled={pending}
              className="hidden"
            />
          </label>
          {avatarUrl && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={pending}
              className="text-xs text-red-600 hover:underline disabled:opacity-50"
            >
              {t("avatarRemoveAction")}
            </button>
          )}
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
