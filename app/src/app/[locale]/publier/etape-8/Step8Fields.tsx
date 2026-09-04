"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { StepShell } from "@/components/wizard/StepShell";
import { useWizard } from "@/components/wizard/WizardContext";

type WilayaRow = { id: number; nomFr: string; nomAr: string };

const ALGERIAN_PHONE = /^(0[5-7]\d{8}|\+213[5-7]\d{8})$/;

export function Step8Fields({
  wilayas,
  userPhone,
}: {
  wilayas: WilayaRow[];
  userPhone: string | null;
}) {
  const t = useTranslations("Wizard");
  const locale = useLocale();
  const { data, setData } = useWizard();
  const [error, setError] = useState<string | null>(null);

  function handleNext() {
    if (!data.wilayaId) {
      setError(t("errorValidation"));
      return false;
    }
    if (!userPhone && !ALGERIAN_PHONE.test((data.phone ?? "").trim())) {
      setError(t("errorPhoneInvalid"));
      return false;
    }
    setError(null);
    return true;
  }

  return (
    <StepShell step={8} title={t("step8Title")} nextLabel={t("next")} onNext={handleNext}>
      <div>
        <label htmlFor="wizard-wilaya" className="block text-sm font-medium text-slate-700 mb-1">
          {t("wilaya")}
        </label>
        <select
          id="wizard-wilaya"
          value={data.wilayaId ?? ""}
          onChange={(e) => {
            const wilaya = wilayas.find((w) => w.id === Number(e.target.value));
            setData({
              wilayaId: wilaya?.id,
              wilayaName: wilaya ? (locale === "ar" ? wilaya.nomAr : wilaya.nomFr) : undefined,
            });
          }}
          className="w-full rounded-md border border-slate-300 px-3 py-2 bg-white"
        >
          <option value="" disabled>
            —
          </option>
          {wilayas.map((w) => (
            <option key={w.id} value={w.id}>
              {locale === "ar" ? w.nomAr : w.nomFr}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="wizard-phone" className="block text-sm font-medium text-slate-700 mb-1">
          {t("phone")}
        </label>
        {userPhone ? (
          <>
            <input
              id="wizard-phone"
              type="tel"
              value={userPhone}
              disabled
              className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-slate-500"
            />
            <p className="mt-1 text-xs text-slate-500">{t("phoneAlreadySet")}</p>
          </>
        ) : (
          <>
            <input
              id="wizard-phone"
              type="tel"
              value={data.phone ?? ""}
              onChange={(e) => setData({ phone: e.target.value })}
              placeholder="0555123456"
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
            <p className="mt-1 text-xs text-slate-500">{t("phoneHint")}</p>
          </>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </StepShell>
  );
}
