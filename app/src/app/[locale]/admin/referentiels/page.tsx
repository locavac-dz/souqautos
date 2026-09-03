import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { isAdmin } from "@/lib/auth-server/roles";
import { CatalogueManager } from "@/components/admin/CatalogueManager";

export default async function CatalogueAdminPage() {
  const currentUser = await getCurrentUser();
  const t = await getTranslations("AdminCatalogue");

  const brands = await prisma.brand.findMany({
    orderBy: { name: "asc" },
    include: {
      models: {
        orderBy: { name: "asc" },
        include: { _count: { select: { listings: true } } },
      },
      _count: { select: { listings: true } },
    },
  });

  const rows = brands.map((brand) => ({
    id: brand.id,
    name: brand.name,
    slug: brand.slug,
    listingCount: brand._count.listings,
    models: brand.models.map((model) => ({
      id: model.id,
      name: model.name,
      slug: model.slug,
      listingCount: model._count.listings,
    })),
  }));

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 mb-2">{t("title")}</h1>
      <p className="text-sm text-slate-500 mb-6">{t("subtitle")}</p>
      <CatalogueManager
        brands={rows}
        canEdit={Boolean(currentUser && isAdmin(currentUser.role))}
      />
    </div>
  );
}
