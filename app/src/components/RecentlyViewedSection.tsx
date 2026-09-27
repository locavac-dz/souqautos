"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { getRecentlyViewed, type RecentlyViewedEntry } from "@/lib/recently-viewed";

export function RecentlyViewedSection({ excludeId }: { excludeId?: string }) {
  const t = useTranslations("RecentlyViewed");
  const locale = useLocale();
  const [entries, setEntries] = useState<RecentlyViewedEntry[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const all = getRecentlyViewed().filter((e) => e.id !== excludeId);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEntries(all);
    setMounted(true);
  }, [excludeId]);

  if (!mounted || entries.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">{t("title")}</h2>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
        {entries.map((entry) => (
          <Link
            key={entry.id}
            href={`/annonce/${entry.id}`}
            className="snap-start shrink-0 w-40 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm transition"
          >
            <div className="relative aspect-[4/3] bg-slate-100 dark:bg-slate-700">
              {entry.photo ? (
                <Image
                  src={entry.photo}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="160px"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-slate-300 text-2xl">
                  🚗
                </div>
              )}
            </div>
            <div className="p-2">
              <p className="text-xs font-medium text-slate-800 dark:text-slate-100 line-clamp-1">{entry.title}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {entry.year} · {locale === "ar" ? entry.wilayaNomAr : entry.wilayaNomFr}
              </p>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-1">
                {entry.price.toLocaleString()} DA
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
