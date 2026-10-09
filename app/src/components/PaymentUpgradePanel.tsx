"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { formatNumber } from "@/lib/format";

export type BankDetails = { bankName: string; bankRib: string; bankAccountHolder: string };

export type PaymentUpgradeLabels = {
  open: string; // libellé du bouton fermé (sans le prix, ajouté ici)
  payOnlineTitle: string;
  payOnlineButton: string;
  payOnlineHint: string;
  payOrByTransfer: string;
  payOnlineError: string;
  instructions: string;
  bankName: string;
  bankRib: string;
  bankHolder: string;
  referenceLabel: string;
  referencePlaceholder: string;
  submit: string;
  cancel: string;
  errorGeneric: string;
  priceSuffix?: string; // ex. « /mois »
};

// Lot 269 (audit E1) — un seul panneau de paiement pour les formules d'annonce et les abonnements pro : les deux
// composants (Lots 66/79/264) ne différaient que par l'adresse, le corps JSON, l'espace de noms des libellés et le
// style du bouton. Deux moyens dans le même panneau : en ligne (Chargily Pay, CIB / Edahabia : le navigateur est
// envoyé sur la page hébergée) et, en repli, le virement bancaire manuel. Chacun n'apparaît que s'il est réellement
// disponible — jamais un bouton qui ne marcherait pas.
export function PaymentUpgradePanel({
  endpoint,
  payload,
  priceDzd,
  bankDetails,
  onlinePayment,
  labels,
  openButtonClassName,
}: {
  endpoint: string;
  payload: Record<string, string>;
  priceDzd: number;
  bankDetails: BankDetails | null;
  onlinePayment: boolean;
  labels: PaymentUpgradeLabels;
  openButtonClassName: string;
}) {
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reference, setReference] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function post(body: Record<string, string>) {
    return fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, ...body }) });
  }

  async function payOnline() {
    setPending(true);
    setError(null);
    const res = await post({ method: "chargily" });
    const data = (await res.json().catch(() => null)) as { checkoutUrl?: string } | null;
    if (res.ok && data?.checkoutUrl) {
      // Page de paiement hébergée par Chargily ; le retour se fait sur la page d'origine (?paiement=…).
      window.location.assign(data.checkoutUrl);
      return;
    }
    setPending(false);
    setError(labels.payOnlineError);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (reference.trim().length < 2) {
      setError(labels.errorGeneric);
      return;
    }
    setPending(true);
    setError(null);
    const res = await post({ method: "virement", reference: reference.trim() });
    setPending(false);
    if (res.ok) {
      setOpen(false);
      router.refresh();
      return;
    }
    setError(labels.errorGeneric);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          setOpen(true);
        }}
        className={openButtonClassName}
      >
        {labels.open} — {formatNumber(priceDzd, locale)} DA{labels.priceSuffix ?? ""}
      </button>
    );
  }

  return (
    <div className="w-full max-w-md rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 space-y-3">
      {onlinePayment && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{labels.payOnlineTitle}</p>
          <button
            type="button"
            onClick={payOnline}
            disabled={pending}
            className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
          >
            {labels.payOnlineButton}
          </button>
          <p className="text-xs text-slate-500 dark:text-slate-400">{labels.payOnlineHint}</p>
        </div>
      )}

      {onlinePayment && bankDetails && (
        <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">{labels.payOrByTransfer}</p>
      )}

      {bankDetails && (
        <form onSubmit={handleSubmit} className="space-y-2">
          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{labels.instructions}</p>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            {labels.bankName}: <strong>{bankDetails.bankName}</strong>
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-300 font-mono">
            {labels.bankRib}: <span dir="ltr">{bankDetails.bankRib}</span>
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            {labels.bankHolder}: {bankDetails.bankAccountHolder}
          </p>
          <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            {labels.referenceLabel}
            <input
              type="text"
              required
              minLength={2}
              maxLength={80}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder={labels.referencePlaceholder}
              className="flex-1 rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 px-2 py-1 text-sm text-slate-900"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {labels.submit}
          </button>
        </form>
      )}

      <button
        type="button"
        onClick={() => {
          setOpen(false);
          setError(null);
        }}
        className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
      >
        {labels.cancel}
      </button>
      {error && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
