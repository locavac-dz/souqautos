"use client";

import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";

type Props = {
  currentView: "list" | "map";
};

export function DirectoryViewToggle({ currentView }: Props) {
  const t = useTranslations("ProDirectory");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function toggle(view: "list" | "map") {
    const params = new URLSearchParams(searchParams.toString());
    if (view === "list") {
      params.delete("view");
    } else {
      params.set("view", "map");
    }
    params.delete("page");
    const qs = params.toString();
    router.push(`${pathname}${qs ? `?${qs}` : ""}`);
  }

  return (
    <div className="flex rounded-md border border-slate-300 dark:border-slate-600 overflow-hidden">
      <button
        onClick={() => toggle("list")}
        className={`px-3 py-1.5 text-sm font-medium transition-colors ${
          currentView === "list"
            ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
            : "bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        }`}
      >
        {t("viewList")}
      </button>
      <button
        onClick={() => toggle("map")}
        className={`px-3 py-1.5 text-sm font-medium transition-colors ${
          currentView === "map"
            ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
            : "bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        }`}
      >
        {t("viewMap")}
      </button>
    </div>
  );
}
