import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function Pagination({
  page,
  totalPages,
  searchParams,
  basePath = "/recherche",
}: {
  page: number;
  totalPages: number;
  searchParams: Record<string, string | undefined>;
  basePath?: string;
}) {
  if (totalPages <= 1) return null;
  const t = await getTranslations("Search");

  function hrefForPage(p: number) {
    const query = new URLSearchParams();
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value && key !== "page") query.set(key, value);
    });
    if (p > 1) query.set("page", String(p));
    const qs = query.toString();
    return `${basePath}${qs ? `?${qs}` : ""}`;
  }

  return (
    <nav aria-label={t("paginationLabel")} className="mt-8 flex items-center justify-center gap-4">
      {page > 1 ? (
        <Link href={hrefForPage(page - 1)} className="text-sm font-medium text-slate-900 hover:underline">
          ← {t("previous")}
        </Link>
      ) : (
        <span aria-disabled="true" className="text-sm text-slate-500">← {t("previous")}</span>
      )}

      <span className="text-sm text-slate-500">{t("pageOf", { page, totalPages })}</span>

      {page < totalPages ? (
        <Link href={hrefForPage(page + 1)} className="text-sm font-medium text-slate-900 hover:underline">
          {t("next")} →
        </Link>
      ) : (
        <span aria-disabled="true" className="text-sm text-slate-500">{t("next")} →</span>
      )}
    </nav>
  );
}
