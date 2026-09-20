"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { StepShell } from "@/components/wizard/StepShell";
import { useWizard } from "@/components/wizard/WizardContext";
import { hasCarBodyFields } from "@/lib/listing-category-fields";
import type { FuelType, Gearbox, Transmission } from "@prisma/client";

const currentYear = new Date().getFullYear();

export default function Step3Page() {
  const t = useTranslations("Wizard");
  const { data, setData } = useWizard();
  const [error, setError] = useState<string | null>(null);

  function handleNext() {
    if (!data.year || !data.mileage || data.mileage < 0 || !data.fuelType || !data.gearbox) {
      setError(t("errorValidation"));
      return false;
    }
    if (data.year < 1970 || data.year > currentYear + 1) {
      setError(t("errorValidation"));
      return false;
    }
    setError(null);
    return true;
  }

  return (
    <StepShell step={3} title={t("step3Title")} nextLabel={t("next")} onNext={handleNext}>
      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className="block text-sm font-medium text-slate-700 mb-1">{t("year")}</span>
          <input
            type="number"
            min={1970}
            max={currentYear + 1}
            value={data.year ?? ""}
            onChange={(e) => setData({ year: e.target.value ? Number(e.target.value) : undefined })}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-slate-700 mb-1">{t("mileage")}</span>
          <input
            type="number"
            min={0}
            value={data.mileage ?? ""}
            onChange={(e) => setData({ mileage: e.target.value ? Number(e.target.value) : undefined })}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className="block text-sm font-medium text-slate-700 mb-1">{t("fuelType")}</span>
          <select
            value={data.fuelType ?? ""}
            onChange={(e) => setData({ fuelType: e.target.value as FuelType })}
            className="w-full rounded-md border border-slate-300 px-3 py-2 bg-white"
          >
            <option value="" disabled>
              —
            </option>
            <option value="ESSENCE">{t("fuelEssence")}</option>
            <option value="DIESEL">{t("fuelDiesel")}</option>
            <option value="GPL">{t("fuelGpl")}</option>
            <option value="HYBRIDE">{t("fuelHybride")}</option>
            <option value="ELECTRIQUE">{t("fuelElectrique")}</option>
          </select>
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-slate-700 mb-1">{t("gearbox")}</span>
          <select
            value={data.gearbox ?? ""}
            onChange={(e) => setData({ gearbox: e.target.value as Gearbox })}
            className="w-full rounded-md border border-slate-300 px-3 py-2 bg-white"
          >
            <option value="" disabled>
              —
            </option>
            <option value="MANUELLE">{t("gearboxManuelle")}</option>
            <option value="AUTOMATIQUE">{t("gearboxAutomatique")}</option>
          </select>
        </label>
      </div>

      {hasCarBodyFields(data.category) && (
        <label className="block">
          <span className="block text-sm font-medium text-slate-700 mb-1">{t("transmission")}</span>
          <select
            value={data.transmission ?? ""}
            onChange={(e) =>
              setData({ transmission: (e.target.value || undefined) as Transmission | undefined })
            }
            className="w-full rounded-md border border-slate-300 px-3 py-2 bg-white"
          >
            <option value="">{t("transmissionNone")}</option>
            <option value="QUATRE_X_DEUX">{t("transmission4x2")}</option>
            <option value="QUATRE_X_QUATRE">{t("transmission4x4")}</option>
          </select>
        </label>
      )}

      {hasCarBodyFields(data.category) ? (
        <div className="grid grid-cols-3 gap-4">
          <label className="block">
            <span className="block text-sm font-medium text-slate-700 mb-1">{t("color")}</span>
            <input
              type="text"
              value={data.color ?? ""}
              onChange={(e) => setData({ color: e.target.value || undefined })}
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-slate-700 mb-1">{t("doors")}</span>
            <input
              type="number"
              min={1}
              max={7}
              value={data.doors ?? ""}
              onChange={(e) => setData({ doors: e.target.value ? Number(e.target.value) : undefined })}
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-slate-700 mb-1">{t("seats")}</span>
            <input
              type="number"
              min={1}
              max={9}
              value={data.seats ?? ""}
              onChange={(e) => setData({ seats: e.target.value ? Number(e.target.value) : undefined })}
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
        </div>
      ) : (
        <label className="block">
          <span className="block text-sm font-medium text-slate-700 mb-1">{t("color")}</span>
          <input
            type="text"
            value={data.color ?? ""}
            onChange={(e) => setData({ color: e.target.value || undefined })}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
      )}

      <label className="block">
        <span className="block text-sm font-medium text-slate-700 mb-1">{t("powerHp")}</span>
        <input
          type="number"
          min={1}
          max={2000}
          value={data.powerHp ?? ""}
          onChange={(e) => setData({ powerHp: e.target.value ? Number(e.target.value) : undefined })}
          className="w-full rounded-md border border-slate-300 px-3 py-2"
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </StepShell>
  );
}
