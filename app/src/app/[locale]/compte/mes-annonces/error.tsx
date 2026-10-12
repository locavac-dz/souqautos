"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { reportClientError } from "@/lib/report-client-error";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("ErrorPage");

  useEffect(() => {
    console.error(error);
    reportClientError(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{t("title")}</h1>
      <p className="mt-3 text-slate-600 dark:text-slate-300">{t("message")}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm">
        <button
          onClick={reset}
          className="rounded-md bg-slate-900 dark:bg-slate-100 px-4 py-2 font-medium text-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-slate-300"
        >
          {t("retry")}
        </button>
        <Link href="/" className="rounded-md border border-slate-300 dark:border-slate-600 px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
          {t("home")}
        </Link>
      </div>
    </div>
  );
}
