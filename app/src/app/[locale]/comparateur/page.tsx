"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useCompare } from "@/components/compare/CompareContext";

type CompareListing = {
  id: string;
  title: string;
  price: number;
  year: number;
  mileage: number;
  fuelType: string;
  gearbox: string;
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
  seller: { email: string; profile: { displayName: string | null } | null };
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

  useEffect(() => {
    if (ids.length === 0) return;
    fetch(`/api/listings/compare?ids=${ids.join(",")}`)
      .then((res) => res.json())
      .then((data) => setListings(data.listings));
  }, [ids]);

  const rows: { label: string; render: (l: CompareListing) => React.ReactNode }[] = [
    {
      label: t("seller"),
      render: (l) => (
        <Link href={`/vendeur/${l.sellerId}`} className="text-slate-900 hover:underline">
          {l.seller.profile?.displayName ?? l.seller.email}
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
    { label: t("price"), render: (l) => `${l.price.toLocaleString()} DA` },
    { label: t("year"), render: (l) => l.year },
    { label: t("mileage"), render: (l) => `${l.mileage.toLocaleString()} km` },
    { label: tWizard("fuelType"), render: (l) => tWizard(FUEL_KEY[l.fuelType]) },
    { label: tWizard("gearbox"), render: (l) => tWizard(GEARBOX_KEY[l.gearbox]) },
    {
      label: tWizard("condition"),
      render: (l) => (l.condition === "NEUF" ? tListing("conditionNeuf") : tListing("conditionOccasion")),
    },
    { label: t("wilaya"), render: (l) => (locale === "ar" ? l.wilaya.nomAr : l.wilaya.nomFr) },
    { label: tWizard("powerHp"), render: (l) => (l.powerHp ? `${l.powerHp} ch` : "—") },
    { label: tWizard("color"), render: (l) => l.color ?? "—" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 pb-24">
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">{t("title")}</h1>

      {ids.length === 0 && <p className="text-slate-500">{t("empty")}</p>}

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
                      <div className="relative aspect-[4/3] rounded-md bg-slate-100 overflow-hidden mb-2">
                        {l.photos[0] && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={l.photos[0].path} alt="" className="h-full w-full object-cover" />
                        )}
                      </div>
                      <Link
                        href={`/annonce/${l.id}`}
                        className="block font-medium text-slate-900 text-sm text-left rtl:text-right line-clamp-2"
                      >
                        {l.title}
                      </Link>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {brandLabel} {modelLabel}
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
                <tr key={row.label} className="border-t border-slate-100">
                  <td className="py-2 pr-4 text-sm text-slate-500">{row.label}</td>
                  {listings.map((l) => (
                    <td key={l.id} className="py-2 px-2 text-sm text-slate-900 text-center">
                      {row.render(l)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
