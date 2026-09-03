"use client";

import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";

export function SortSelect({ current }: { current: string }) {
  const t = useTranslations("Search");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(value: string) {
    const query = new URLSearchParams(searchParams.toString());
    if (value === "recent") query.delete("sort");
    else query.set("sort", value);
    query.delete("page");
    const qs = query.toString();
    router.push(`${pathname}${qs ? `?${qs}` : ""}`);
  }

  return (
    <select
      value={current}
      onChange={(e) => handleChange(e.target.value)}
      className="rounded-md border border-slate-300 px-3 py-2 bg-white text-sm"
    >
      <option value="recent">{t("sortRecent")}</option>
      <option value="price_asc">{t("sortPriceAsc")}</option>
      <option value="price_desc">{t("sortPriceDesc")}</option>
    </select>
  );
}
