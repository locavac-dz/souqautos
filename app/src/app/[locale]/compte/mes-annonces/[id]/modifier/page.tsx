import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { redirect } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { checkListingContentEditable } from "@/lib/listing-lifecycle";
import { canManageListing } from "@/lib/listing-access";
import { ListingEditForm } from "@/components/ListingEditForm";

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id } = await params;
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: "/connexion", locale });
    return null;
  }

  const t = await getTranslations("ListingEdit");

  const [listing, wilayas, brands, equipments] = await Promise.all([
    prisma.listing.findUnique({
      where: { id },
      include: {
        photos: { orderBy: { position: "asc" } },
        equipments: { select: { equipmentId: true } },
      },
    }),
    prisma.wilaya.findMany({
      orderBy: { id: "asc" },
      include: { communes: { orderBy: { nomFr: "asc" } } },
    }),
    prisma.brand.findMany({
      orderBy: { name: "asc" },
      include: {
        models: {
          orderBy: { name: "asc" },
          include: { generations: { orderBy: { yearStart: "desc" } } },
        },
      },
    }),
    prisma.equipment.findMany({
      orderBy: { nameFr: "asc" },
      select: { id: true, nameFr: true, nameAr: true, category: true },
    }),
  ]);

  if (!listing || !(await canManageListing(user.id, listing.sellerId))) {
    notFound();
  }

  const eligibility = checkListingContentEditable(listing.status);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-2">{t("title")}</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{t("subtitle")}</p>

      {!eligibility.ok ? (
        <p className="text-sm text-red-600">{t("notEditable")}</p>
      ) : (
        <ListingEditForm listing={listing} wilayas={wilayas} brands={brands} equipments={equipments} />
      )}
    </div>
  );
}
