"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { StepShell } from "@/components/wizard/StepShell";
import { useWizard } from "@/components/wizard/WizardContext";

const MAX_PHOTOS = 10;

export default function Step6Page() {
  const t = useTranslations("Wizard");
  const { photos, setPhotos } = useWizard();
  const [error, setError] = useState<string | null>(null);

  const previews = useMemo(() => photos.map((file) => URL.createObjectURL(file)), [photos]);

  useEffect(() => {
    return () => {
      previews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previews]);

  function handleAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setPhotos([...photos, ...files].slice(0, MAX_PHOTOS));
  }

  function handleRemove(index: number) {
    setPhotos(photos.filter((_, i) => i !== index));
  }

  function handleNext() {
    if (photos.length < 1 || photos.length > MAX_PHOTOS) {
      setError(t("photosCountError"));
      return false;
    }
    setError(null);
    return true;
  }

  return (
    <StepShell step={6} title={t("step6Title")} nextLabel={t("next")} onNext={handleNext}>
      <p className="text-sm text-slate-500">{t("photosHelp")}</p>

      <div className="grid grid-cols-3 gap-3">
        {previews.map((url, i) => (
          <div key={i} className="relative group">
            {/* eslint-disable-next-line @next/next/no-img-element -- aperçu local d'un fichier non encore uploadé (objet Blob, pas d'URL optimisable) */}
            <img
              src={url}
              alt=""
              className="aspect-square w-full rounded-md object-cover border border-slate-200"
            />
            <button
              type="button"
              onClick={() => handleRemove(i)}
              className="absolute top-1 right-1 rounded bg-black/60 px-2 py-0.5 text-xs text-white opacity-0 group-hover:opacity-100"
            >
              {t("photosRemove")}
            </button>
          </div>
        ))}

        {photos.length < MAX_PHOTOS && (
          <label className="aspect-square flex items-center justify-center rounded-md border-2 border-dashed border-slate-300 text-slate-400 text-sm cursor-pointer hover:border-slate-400">
            {t("photosAdd")}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={handleAdd}
              className="hidden"
            />
          </label>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </StepShell>
  );
}
