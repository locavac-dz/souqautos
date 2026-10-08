"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { formatNumber, formatPrice } from "@/lib/format";
import { useCompare } from "@/components/compare/CompareContext";
import type { CompareHighlights } from "@/lib/ai-compare";

type CompareListing = {
  id: string;
  title: string;
  price: number;
  year: number;
  // Lot 260 : nuls pour une annonce Équipement (le type local doit le dire, sinon tsc ne voit pas le null — audit A4).
  mileage: number | null;
  fuelType: string | null;
  gearbox: string | null;
  condition: string;
  color: string | null;
  powerHp: number | null;
  brand: { name: string } | null;
  model: { name: string } | null;
  brandFreeText: string | null;
  modelFreeText: string | null;
  wilaya: { nomFr: string; nomAr: string };
  photos: { path: string }[];
  sellerId: string;
  seller: { id: string; profile: { displayName: string | null } | null };
  sellerTrust: { trustBreakdown: { score: number }; averageRating: number; reviewCount: number } | null;
};

const FUEL_KEY: Record<string, string> = {
  ESSENCE: "fuelEssence",
  DIESEL: "fuelDiesel",
  GPL: "fuelGpl",
  HYBRIDE: "fuelHybride",
  ELECTRIQUE: "fuelElectrique",
};
const GEARBOX_KEY: Record<string, string> = {
  MANUELLE: "gearboxManuelle",
  AUTOMATIQUE: "gearboxAutomatique",
};

export default function ComparePage() {
  const t = useTranslations("Compare");
  const tWizard = useTranslations("Wizard");
  const tListing = useTranslations("Listing");
  const tReview = useTranslations("Review");
  const tTrustScore = useTranslations("TrustScore");
  const locale = useLocale();
  const { ids, toggle } = useCompare();
  const [listings, setListings] = useState<CompareListing[]>([]);
  // `forIds` mémorise la sélection pour laquelle la synthèse a été calculée —
  // un changement de sélection invalide implicitement l'ancienne synthèse au
  // rendu (ci-dessous), jamais besoin de la réinitialiser explicitement dans
  // un effet (évite un setState synchrone superflu dans l'effet de chargement).
  const [summary, setSummary] = useState<{
    highlights: CompareHighlights;
    narrative: string | null;
    forIds: string;
  } | null>(null);
  const [summaryPending, setSummaryPending] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const idsKey = ids.join(",");
  const currentSummary = summary && summary.forIds === idsKey ? summary : null;

  useEffect(() => {
    if (ids.length === 0) return;
    fetch(`/api/listings/compare?ids=${ids.join(",")}`)
      .then((res) => res.json())
      .then((data) => setListings(data.listings));
  }, [ids]);

  async function requestSummary() {
    setSummaryPending(true);
    setSummaryError(null);

    const res = await fetch("/api/listings/compare-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, locale }),
    });

    setSummaryPending(false);

    if (res.status === 401) {
      setSummaryError(t("summaryLoginRequired"));
      return;
    }
    if (!res.ok) {
      setSummaryError(t("summaryErrorGeneric"));
      return;
    }

    const data = await res.json();
    setSummary({ highlights: data.highlights, narrative: data.narrative, forIds: idsKey });
  }

  const rows: { label: string; render: (l: CompareListing) => React.ReactNode }[] = [
    {
      label: t("seller"),
      render: (l) => (
        <Link href={`/vendeur/${l.sellerId}`} className="text-slate-900 dark:text-slate-100 hover:underline">
          {l.seller.profile?.displayName ?? "—"}
        </Link>
      ),
    },
    {
      label: t("sellerTrustScore"),
      render: (l) => (l.sellerTrust ? tTrustScore("scoreValue", { score: l.sellerTrust.trustBreakdown.score }) : "—"),
    },
    {
      label: t("sellerReviews"),
      render: (l) =>
        l.sellerTrust && l.sellerTrust.reviewCount > 0
          ? tReview("averageRating", { average: l.sellerTrust.averageRating, count: l.sellerTrust.reviewCount })
          : tReview("noReviews"),
    },
    { label: t("price"), render: (l) => formatPrice(l.price, locale) },
    { label: t("year"), render: (l) => l.year },
    { label: t("mileage"), render: (l) => (l.mileage !== null ? `${formatNumber(l.mileage, locale)} km` : "—") },
    { label: tWizard("fuelType"), render: (l) => (l.fuelType && FUEL_KEY[l.fuelType] ? tWizard(FUEL_KEY[l.fuelType]) : "—") },
    { label: tWizard("gearbox"), render: (l) => (l.gearbox && GEARBOX_KEY[l.gearbox] ? tWizard(GEARBOX_KEY[l.gearbox]) : "—") },
    {
      label: tWizard("condition"),
      render: (l) => (l.condition === "NEUF" ? tListing("conditionNeuf") : tListing("conditionOccasion")),
    },
    { label: t("wilaya"), render: (l) => (locale === "ar" ? l.wilaya.nomAr : l.wilaya.nomFr) },
    { label: tWizard("powerHp"), render: (l) => (l.powerHp ? `${l.powerHp} ch` : "—") },
    { label: tWizard("color"), render: (l) => l.color ?? "—" },
  ];

  function titleForId(id: string): string {
    return listings.find((l) => l.id === id)?.title ?? "";
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 pb-24">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-6">{t("title")}</h1>

      {ids.length === 0 && <p className="text-slate-500 dark:text-slate-400">{t("empty")}</p>}

      {listings.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[600px]">
            <thead>
              <tr>
                <th className="w-40" />
                {listings.map((l) => {
                  const brandLabel = l.brand?.name ?? l.brandFreeText ?? "";
                  const modelLabel = l.model?.name ?? l.modelFreeText ?? "";
                  return (
                    <th key={l.id} className="p-2 align-bottom">
                      <div className="relative aspect-[4/3] rounded-md bg-slate-100 dark:bg-slate-700 overflow-hidden mb-2">
                        {l.photos[0] && (
                          <Image src={l.photos[0].path} alt="" fill sizes="(max-width: 768px) 50vw, 25vw" className="object-cover" />
                        )}
                      </div>
                      <Link
                        href={`/annonce/${l.id}`}
                        className="block font-medium text-slate-900 dark:text-slate-100 text-sm text-left rtl:text-right line-clamp-2"
                      >
                        {l.title}
                      </Link>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        <span lang="fr">{brandLabel} {modelLabel}</span>
                      </p>
                      <button
                        type="button"
                        onClick={() => toggle(l.id)}
                        className="mt-1 text-xs text-red-600 hover:underline"
                      >
                        {t("remove")}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-t border-slate-100 dark:border-slate-700">
                  <td className="py-2 pr-4 text-sm text-slate-500 dark:text-slate-400">{row.label}</td>
                  {listings.map((l) => (
                    <td key={l.id} className="py-2 px-2 text-sm text-slate-900 dark:text-slate-100 text-center">
                      {row.render(l)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {listings.length >= 2 && (
        <div className="mt-8 rounded-lg border border-slate-200 dark:border-slate-700 p-4 max-w-2xl">
          {!currentSummary && !summaryPending && (
            <button
              type="button"
              onClick={requestSummary}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
            >
              {t("summaryButton")}
            </button>
          )}
          {summaryPending && <p className="text-sm text-slate-500 dark:text-slate-400">{t("summaryPending")}</p>}
          {summaryError && <p className="text-sm text-red-600">{summaryError}</p>}
          {currentSummary && (
            <div>
              <h2 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">{t("summaryTitle")}</h2>
              <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-300 list-disc pl-4 rtl:pl-0 rtl:pr-4">
                {currentSummary.highlights.cheapestId && (
                  <li>
                    {t("summaryCheapest", { title: titleForId(currentSummary.highlights.cheapestId) })}
                  </li>
                )}
                {currentSummary.highlights.lowestMileageId && (
                  <li>
                    {t("summaryLowestMileage", { title: titleForId(currentSummary.highlights.lowestMileageId) })}
                  </li>
                )}
                {currentSummary.highlights.newestId && (
                  <li>{t("summaryNewest", { title: titleForId(currentSummary.highlights.newestId) })}</li>
                )}
                {currentSummary.highlights.mostPowerfulId && (
                  <li>
                    {t("summaryMostPowerful", { title: titleForId(currentSummary.highlights.mostPowerfulId) })}
                  </li>
                )}
                {currentSummary.highlights.mostTrustedId && (
                  <li>
                    {t("summaryMostTrusted", { title: titleForId(currentSummary.highlights.mostTrustedId) })}
                  </li>
                )}
              </ul>
              {currentSummary.narrative && (
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 border-t border-slate-100 dark:border-slate-700 pt-3">
                  {currentSummary.narrative}
                </p>
              )}
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{t("summaryDisclaimer")}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
