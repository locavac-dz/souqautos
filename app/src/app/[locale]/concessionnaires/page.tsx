import type { Metadata } from "next";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { SITE_URL } from "@/lib/site";
import { buildBreadcrumbJsonLd, safeJsonLdStringify } from "@/lib/structured-data";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Pagination } from "@/components/search/Pagination";
import {
  DIRECTORY_PAGE_SIZE,
  countByWilaya,
  directoryParamsSchema,
  filterByWilaya,
  filterByCategory,
  getDirectoryEntries,
  paginate,
  sortDirectoryEntries,
} from "@/lib/professional-directory";
import { PRO_CATEGORIES } from "@/lib/validation/pro-account";

type RawSearchParams = Promise<Record<string, string | string[] | undefined>>;

async function parseParams(searchParams: RawSearchParams) {
  const raw = await searchParams;
  const flat: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(raw)) {
    flat[key] = Array.isArray(value) ? value[0] : value;
  }
  return directoryParamsSchema.parse(flat);
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: RawSearchParams;
}): Promise<Metadata> {
  const { locale } = await params;
  const { wilaya, page } = await parseParams(searchParams);
  const t = await getTranslations({ locale, namespace: "ProDirectory" });

  // Un slug inconnu n'a aucun effet sur la page (liste complète) : il ne doit
  // pas non plus se retrouver dans l'URL canonique.
  const knownWilaya = wilaya
    ? await prisma.wilaya.findUnique({ where: { slug: wilaya }, select: { id: true } })
    : null;

  const query = new URLSearchParams();
  if (wilaya && knownWilaya) query.set("wilaya", wilaya);
  if (page && page > 1) query.set("page", String(page));
  const qs = query.toString();
  const canonical = `${SITE_URL}/${locale}/concessionnaires${qs ? `?${qs}` : ""}`;

  return {
    title: `${t("title")} — Souq Auto`,
    description: t("subtitle"),
    alternates: { canonical },
    openGraph: { title: t("title"), url: canonical, type: "website" },
  };
}

export default async function ProDirectoryPage({ searchParams }: { searchParams: RawSearchParams }) {
  const locale = await getLocale();
  const t = await getTranslations("ProDirectory");
  const tReview = await getTranslations("Review");
  const tCatalogue = await getTranslations("Catalogue");
  const tPro = await getTranslations("Pro");
  const params = await parseParams(searchParams);

  const [entries, wilayas] = await Promise.all([
    getDirectoryEntries(),
    prisma.wilaya.findMany({ orderBy: { nomFr: "asc" }, select: { id: true, slug: true, nomFr: true, nomAr: true } }),
  ]);

  const sorted = sortDirectoryEntries(entries);
  const wilayaCounts = countByWilaya(sorted);
  const wilayaLabel = (w: { nomFr: string; nomAr: string }) => (locale === "ar" ? w.nomAr : w.nomFr);
  const wilayaById = new Map(wilayas.map((w) => [w.id, w]));
  // Filtres : wilaya (slug) et catégorie. Les valeurs inconnues sont ignorées (liste complète).
  const selectedWilaya = wilayas.find((w) => w.slug === params.wilaya);
  const selectedCategory = params.category;
  const filtered = filterByCategory(filterByWilaya(sorted, selectedWilaya?.id), selectedCategory);
  const pageData = paginate(filtered, params.page, DIRECTORY_PAGE_SIZE);

  const breadcrumbItems = [{ name: t("breadcrumbHome"), href: "/" }, { name: t("title") }];
  const jsonLd = buildBreadcrumbJsonLd([
    { name: t("breadcrumbHome"), url: `${SITE_URL}/${locale}` },
    { name: t("title"), url: `${SITE_URL}/${locale}/concessionnaires` },
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }} />

      <Breadcrumbs items={breadcrumbItems} />

      <h1 className="text-2xl font-semibold text-slate-900">{t("title")}</h1>
      <p className="mt-1 text-sm text-slate-500">{t("subtitle")}</p>

      <form method="get" className="mt-6 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="block text-sm text-slate-700">{t("wilayaFilterLabel")}</span>
          <select
            name="wilaya"
            defaultValue={selectedWilaya?.slug ?? ""}
            className="mt-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">{t("allWilayas")}</option>
            {wilayas
              .filter((w) => wilayaCounts.has(w.id))
              .map((w) => (
                <option key={w.id} value={w.slug}>
                  {wilayaLabel(w)} ({wilayaCounts.get(w.id)})
                </option>
              ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-sm text-slate-700">{t("categoryFilterLabel")}</span>
          <select
            name="category"
            defaultValue={selectedCategory ?? ""}
            className="mt-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">{t("allCategories")}</option>
            {PRO_CATEGORIES.map((c) => (
              <option key={c} value={c}>{tPro(`categoryPro_${c}`)}</option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          {t("filterSubmit")}
        </button>
      </form>

      {pageData.totalCount === 0 ? (
        <p className="mt-8 py-12 text-center text-slate-500">
          {selectedWilaya ? t("emptyFiltered") : t("empty")}
        </p>
      ) : (
        <>
          <p className="mt-6 text-sm text-slate-500">{t("resultsCount", { count: pageData.totalCount })}</p>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pageData.items.map((entry) => {
              const wilaya = entry.wilayaId ? wilayaById.get(entry.wilayaId) : undefined;
              return (
                <Link
                  key={entry.id}
                  href={`/pro/${entry.id}`}
                  className="flex gap-3 rounded-lg border border-slate-200 p-4 hover:border-slate-300"
                >
                  {entry.logoUrl ? (
                    <div className="relative h-12 w-12 shrink-0">
                      <Image
                        src={entry.logoUrl}
                        alt=""
                        fill
                        sizes="48px"
                        className="rounded-full object-cover border border-slate-200"
                      />
                    </div>
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-lg font-medium text-slate-500">
                      {entry.nomCommercial.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">
                      {entry.nomCommercial}
                      {entry.badgeVerifie && (
                        <span className="ms-2 text-xs font-normal text-emerald-700">
                          {tPro("verifiedBadge")}
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-slate-500">
                      {entry.categoryPro && <span>{tPro(`categoryPro_${entry.categoryPro}`)}{wilaya ? " · " : ""}</span>}
                      {wilaya && wilayaLabel(wilaya)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {tCatalogue("statsCount", { count: entry.listingCount })}
                    </p>
                    <p className="mt-0.5 text-xs">
                      {entry.ratingCount > 0 ? (
                        <span className="text-amber-600">
                          ★ {tReview("averageRating", { average: entry.ratingAverage, count: entry.ratingCount })}
                        </span>
                      ) : (
                        <span className="text-slate-500">{tReview("noReviews")}</span>
                      )}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
          <Pagination
            page={pageData.page}
            totalPages={pageData.totalPages}
            searchParams={{ wilaya: selectedWilaya?.slug, category: selectedCategory }}
            basePath="/concessionnaires"
          />
        </>
      )}
    </div>
  );
}
