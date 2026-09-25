"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { StepShell } from "@/components/wizard/StepShell";
import { useWizard } from "@/components/wizard/WizardContext";

export default function Step11Page() {
  const t = useTranslations("Wizard");
  const router = useRouter();
  const { data, photos, reset } = useWizard();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePublish() {
    setPending(true);
    setError(null);

    const payload = {
      category: data.category,
      brandId: data.brandId,
      brandFreeText: data.brandFreeText,
      modelId: data.modelId,
      modelFreeText: data.modelFreeText,
      generationId: data.generationId,
      title: data.title,
      description: data.description,
      price: data.price,
      year: data.year,
      mileage: data.mileage,
      fuelType: data.fuelType,
      gearbox: data.gearbox,
      transmission: data.transmission,
      color: data.color,
      doors: data.doors,
      seats: data.seats,
      powerHp: data.powerHp,
      fiscalPower: data.fiscalPower,
      bodyType: data.bodyType,
      negotiable: data.negotiable ?? false,
      condition: data.condition,
      firstHand: data.firstHand ?? false,
      accidented: data.accidented ?? false,
      controltechniqueExpiry: data.controltechniqueExpiry || undefined,
      assuranceExpiry: data.assuranceExpiry || undefined,
      wilayaId: data.wilayaId,
      communeId: data.communeId,
      phone: data.phone,
      equipmentIds: data.equipmentIds ?? [],
    };

    const formData = new FormData();
    formData.set("data", JSON.stringify(payload));
    photos.forEach((file) => formData.append("photos", file));

    const res = await fetch("/api/listings", { method: "POST", body: formData });

    if (res.ok) {
      const body = await res.json();
      reset();
      router.push(`/annonce/${body.listing.id}?published=1`);
      return;
    }

    setPending(false);
    const body = await res.json().catch(() => null);
    if (body?.error === "photo_invalid_type" || body?.error === "photo_too_large") {
      setError(t("errorValidation"));
    } else if (body?.error === "phone_taken") {
      setError(t("errorPhoneTaken"));
    } else {
      setError(t("errorGeneric"));
    }
  }

  return (
    <StepShell
      step={11}
      title={t("step11Title")}
      nextLabel={pending ? t("publishing") : t("publish")}
      nextPending={pending}
      onNext={() => {
        handlePublish();
        return false; // navigation gérée manuellement après succès
      }}
    >
      <p className="text-slate-600">{t("step11Body")}</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </StepShell>
  );
}
