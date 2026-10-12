"use client";

import { useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { estimateAllFormulas, type InsuranceFormula, type FormulaEstimate } from "@/lib/insurance-estimate";

type WilayaRow = { id: number; nomFr: string; nomAr: string };

function formatNumber(n: number, locale: string): string {
  return new Intl.NumberFormat(locale === "ar" ? "ar-DZ" : "fr-DZ").format(n);
}

export function InsuranceForm({ wilayas }: { wilayas: WilayaRow[] }) {
  const t = useTranslations("Insurance");
  const locale = useLocale();
  const searchParams = useSearchParams();

  const [fiscalPower, setFiscalPower] = useState(searchParams.get("fiscalPower") ?? "");
  const [year, setYear] = useState(searchParams.get("year") ?? "");
  const [wilayaId, setWilayaId] = useState(searchParams.get("wilayaId") ?? "");
  const [selectedFormula, setSelectedFormula] = useState<InsuranceFormula>("rc_tiers");

  // Quote request form
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fp = parseInt(fiscalPower, 10);
  const estimates = useMemo(() => {
    if (!fp || fp < 1 || fp > 99) return null;
    return estimateAllFormulas(fp);
  }, [fp]);

  async function submitQuote(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/assurance/devis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fiscalPower: fp,
          year: parseInt(year, 10),
          wilayaId: parseInt(wilayaId, 10),
          formula: selectedFormula,
          name,
          phone,
          email,
          honeypot,
        }),
      });
      if (res.ok) {
        setSuccess(true);
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

  const fieldClass = "w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500";
  const labelClass = "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1";

  const currentYear = new Date().getFullYear();

  return (
    <div className="space-y-8">
      {/* Section 1: Calculateur */}
      <section>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">{t("calculatorTitle")}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="ins-fp" className={labelClass}>{t("fiscalPower")}</label>
            <input
              id="ins-fp"
              type="number"
              min={1}
              max={99}
              value={fiscalPower}
              onChange={(e) => setFiscalPower(e.target.value)}
              placeholder="7"
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor="ins-year" className={labelClass}>{t("year")}</label>
            <input
              id="ins-year"
              type="number"
              min={1970}
              max={currentYear + 1}
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder={String(currentYear)}
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor="ins-wilaya" className={labelClass}>{t("wilaya")}</label>
            <select
              id="ins-wilaya"
              value={wilayaId}
              onChange={(e) => setWilayaId(e.target.value)}
              className={fieldClass}
            >
              <option value="">{t("wilayaPlaceholder")}</option>
              {wilayas.map((w) => (
                <option key={w.id} value={w.id}>
                  {locale === "ar" ? w.nomAr : w.nomFr}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Section 2: Comparateur de formules */}
      {estimates && (
        <section>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">{t("comparisonTitle")}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {estimates.map((est) => (
              <FormulaCard
                key={est.formula}
                estimate={est}
                selected={selectedFormula === est.formula}
                onSelect={() => setSelectedFormula(est.formula)}
                locale={locale}
                t={t}
              />
            ))}
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">{t("comparisonNote")}</p>
        </section>
      )}

      {/* Section 3: Demande de devis */}
      {estimates && (
        <section>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">{t("quoteTitle")}</h2>
          {success ? (
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950 p-6 text-center space-y-2">
              <p className="text-lg font-semibold text-emerald-800 dark:text-emerald-200">{t("quoteSuccessTitle")}</p>
              <p className="text-sm text-emerald-700 dark:text-emerald-300">{t("quoteSuccessBody")}</p>
            </div>
          ) : (
            <form onSubmit={submitQuote} className="space-y-4" noValidate>
              <div className="hidden" aria-hidden="true">
                <label htmlFor="ins-hp">Ne pas remplir</label>
                <input id="ins-hp" type="text" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
              </div>

              <p className="text-sm text-slate-600 dark:text-slate-400">
                {t("quoteSubtitle", { formula: t(`formula_${selectedFormula}`) })}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="ins-name" className={labelClass}>{t("name")}</label>
                  <input id="ins-name" type="text" value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} required />
                </div>
                <div>
                  <label htmlFor="ins-phone" className={labelClass}>{t("phone")}</label>
                  <input id="ins-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0555 12 34 56" className={fieldClass} required />
                </div>
              </div>
              <div>
                <label htmlFor="ins-email" className={labelClass}>{t("email")}</label>
                <input id="ins-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={fieldClass} required />
              </div>

              {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {loading ? t("sending") : t("quoteSubmit")}
              </button>
            </form>
          )}
        </section>
      )}
    </div>
  );
}

function FormulaCard({
  estimate,
  selected,
  onSelect,
  locale,
  t,
}: {
  estimate: FormulaEstimate;
  selected: boolean;
  onSelect: () => void;
  locale: string;
  t: ReturnType<typeof useTranslations<"Insurance">>;
}) {
  const borderClass = selected
    ? "border-emerald-500 dark:border-emerald-400 ring-2 ring-emerald-500/20"
    : "border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-700";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`rounded-lg border ${borderClass} bg-white dark:bg-slate-800 p-4 text-start transition-all`}
    >
      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">
        {t(`formula_${estimate.formula}`)}
      </p>
      <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mb-3">
        {formatNumber(estimate.lowDzd, locale)} — {formatNumber(estimate.highDzd, locale)}
        <span className="text-xs font-normal text-slate-500 dark:text-slate-400"> DA/an</span>
      </p>
      <ul className="space-y-1">
        {estimate.covers.map((key) => (
          <li key={key} className="flex items-start gap-1.5 text-xs text-slate-600 dark:text-slate-400">
            <span className="text-emerald-500 mt-0.5" aria-hidden="true">&#10003;</span>
            {t(key)}
          </li>
        ))}
      </ul>
    </button>
  );
}
