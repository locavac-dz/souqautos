import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { estimateParamsSchema } from "@/lib/validation/estimate";
import { estimatePrice } from "@/lib/price-estimation";
import { EstimateForm } from "@/components/estimate/EstimateForm";

const CONFIDENCE_KEY: Record<string, string> = {
  faible: "confidenceFaible",
  moyenne: "confidenceMoyenne",
  bonne: "confidenceBonne",
  elevee: "confidenceElevee",
};

export default async function EstimatePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const rawParams = await searchParams;
  const flatParams: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(rawParams)) {
    flatParams[key] = Array.isArray(value) ? value[0] : value;
  }

  const params = estimateParamsSchema.parse(flatParams);
  const t = await getTranslations("Estimate");

  const [brands, wilayas] = await Promise.all([
    prisma.brand.findMany({
      include: { models: { orderBy: { name: "asc" } } },
      orderBy: { name: "asc" },
    }),
    prisma.wilaya.findMany({ orderBy: { id: "asc" } }),
  ]);

  const hasQuery = Boolean(params.brandId && params.modelId);
  const estimate = hasQuery
    ? await estimatePrice({
        brandId: params.brandId!,
        modelId: params.modelId!,
        year: params.year,
        mileage: params.mileage,
        wilayaId: params.wilayaId,
      })
    : null;

  const brandName = brands.find((b) => b.id === params.brandId)?.name;
  const modelName = brands
    .find((b) => b.id === params.brandId)
    ?.models.find((m) => m.id === params.modelId)?.name;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{t("title")}</h1>
      <p className="mt-1 text-slate-500 dark:text-slate-400">{t("subtitle")}</p>

      <div className="mt-8 grid sm:grid-cols-[300px_1fr] gap-8">
        <EstimateForm
          brands={brands}
          wilayas={wilayas}
          initialValues={{
            brandId: flatParams.brandId,
            modelId: flatParams.modelId,
            year: flatParams.year,
            mileage: flatParams.mileage,
            wilayaId: flatParams.wilayaId,
          }}
        />

        <div>
          {!hasQuery && <p className="text-slate-500 dark:text-slate-400">{t("selectBrandModelPrompt")}</p>}

          {hasQuery && !estimate && <p className="text-slate-500 dark:text-slate-400">{t("noData")}</p>}

          {hasQuery && estimate && (
            <div className="rounded-lg border border-slate-200 p-6 dark:border-slate-700">
              <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{t("resultTitle")}</h2>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {brandName} {modelName}
              </p>

              <div className="mt-4 rounded-md bg-slate-50 px-4 py-3 text-center dark:bg-slate-800">
                <p className="text-xs text-slate-500 dark:text-slate-400">{t("rangeMid")}</p>
                <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                  {estimate.mid.toLocaleString()} DA
                </p>
              </div>

              <div className="mt-3 flex items-center justify-between text-sm">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t("rangeLow")}</p>
                  <p className="font-medium text-slate-700 dark:text-slate-300">{estimate.low.toLocaleString()} DA</p>
                </div>
                <div className="text-right rtl:text-left">
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t("rangeHigh")}</p>
                  <p className="font-medium text-slate-700 dark:text-slate-300">{estimate.high.toLocaleString()} DA</p>
                </div>
              </div>

              {estimate.sampleSize === 1 && (
                <p className="mt-4 text-sm text-amber-600 dark:text-amber-400">{t("singleSampleNote")}</p>
              )}

              <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                {t("sampleSize", { count: estimate.sampleSize })}
              </p>

              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {t("confidence")} :{" "}
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {t(CONFIDENCE_KEY[estimate.confidenceLabel])}
                </span>{" "}
                ({estimate.confidencePct}%)
              </p>

              <div className="mt-3 space-y-1">
                {!estimate.appliedFilters.wilaya && params.wilayaId && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t("filterWilayaRelaxed")}</p>
                )}
                {!estimate.appliedFilters.mileage && params.mileage && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t("filterMileageRelaxed")}</p>
                )}
                {!estimate.appliedFilters.year && params.year && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t("filterYearRelaxed")}</p>
                )}
              </div>

              <p className="mt-4 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-700 pt-3">
                {t("disclaimer")}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
