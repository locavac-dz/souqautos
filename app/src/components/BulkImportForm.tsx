"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

type RejectedRow = { row: number; error: string };
type ImportResult = { imported: number; rejected: RejectedRow[] };

const KNOWN_ERRORS = new Set([
  "invalid_category",
  "wrong_category",
  "invalid_fuel_type",
  "invalid_gearbox",
  "invalid_condition",
  "invalid_transmission",
  "unknown_wilaya",
  "missing_brand",
  "invalid_price",
  "invalid_year",
  "invalid_mileage",
  "validation",
]);

export function BulkImportForm({ accountId }: { accountId: string }) {
  const t = useTranslations("BulkImport");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError(t("errorFileRequired"));
      return;
    }

    setPending(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.set("file", file);

    const res = await fetch(`/api/pro/accounts/${accountId}/bulk-import`, {
      method: "POST",
      body: formData,
    });

    setPending(false);

    if (res.ok) {
      const data: ImportResult = await res.json();
      setResult(data);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const data = await res.json().catch(() => null);
    const code = data?.error;
    if (code === "forbidden") setError(t("errorForbidden"));
    else if (code === "phone_required") setError(t("errorPhoneRequired"));
    else if (code === "file_required") setError(t("errorFileRequired"));
    else if (code === "empty_file") setError(t("errorEmptyFile"));
    else if (code === "too_many_rows") setError(t("errorTooManyRows"));
    else setError(t("errorGeneric"));
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="text-sm font-medium text-slate-700">
          {t("fileLabel")}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="mt-1 block w-full text-sm text-slate-600"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="self-start rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {pending ? t("submitting") : t("submit")}
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {result && (
        <div className="mt-6 rounded-md border border-slate-200 p-4">
          <p className="text-sm text-emerald-700 font-medium">
            {t("resultImported", { count: result.imported })}
          </p>
          {result.imported > 0 && (
            <Link href="/compte/mes-annonces" className="text-xs text-slate-500 underline hover:text-slate-700">
              {t("goToMyListings")}
            </Link>
          )}
          {result.rejected.length > 0 && (
            <div className="mt-3">
              <p className="text-sm text-red-600 font-medium">
                {t("resultRejectedTitle", { count: result.rejected.length })}
              </p>
              <ul className="mt-1 space-y-0.5 text-xs text-red-600">
                {result.rejected.map((r) => (
                  <li key={r.row}>
                    {t("rowLabel", { row: r.row })} — {t(KNOWN_ERRORS.has(r.error) ? `error_${r.error}` : "errorGeneric")}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
