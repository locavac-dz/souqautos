"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useCompare } from "./CompareContext";

export function CompareTray() {
  const t = useTranslations("Compare");
  const { ids, clear } = useCompare();

  if (ids.length === 0) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 border-t border-slate-200 bg-white px-4 py-3 shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
      <div className="mx-auto max-w-6xl flex items-center justify-between gap-4">
        <p className="text-sm text-slate-700">{t("trayCount", { count: ids.length })}</p>
        <div className="flex items-center gap-3">
          <button type="button" onClick={clear} className="text-sm text-slate-500 hover:text-slate-700">
            {t("clear")}
          </button>
          <Link
            href="/comparateur"
            aria-disabled={ids.length < 2}
            className={`rounded-md px-4 py-2 text-sm font-medium text-white ${
              ids.length < 2 ? "bg-slate-300 pointer-events-none" : "bg-slate-900 hover:bg-slate-700"
            }`}
          >
            {t("compareButton")}
          </Link>
        </div>
      </div>
    </div>
  );
}
