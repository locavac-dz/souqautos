import { NextRequest } from "next/server";
import { apiHandler, requireRole } from "@/lib/api-route";
import { isModerator } from "@/lib/auth-server/roles";
import { prisma } from "@/lib/prisma";
import { buildCsv, csvResponse, type CsvColumn } from "@/lib/csv-export";

type Row = {
  id: string;
  title: string;
  category: string;
  brand: { name: string } | null;
  model: { name: string } | null;
  brandFreeText: string | null;
  modelFreeText: string | null;
  price: number;
  year: number;
  mileage: number | null;
  fuelType: string | null;
  gearbox: string | null;
  condition: string;
  color: string | null;
  wilaya: { nomFr: string };
  status: string;
  formula: string;
  fraudScore: number;
  views: number;
  negotiable: boolean;
  seller: { email: string; profile: { displayName: string | null } | null };
  createdAt: Date;
  publishedAt: Date | null;
};

const COLUMNS: CsvColumn<Row>[] = [
  { header: "ID", value: (r) => r.id },
  { header: "Titre", value: (r) => r.title },
  { header: "Catégorie", value: (r) => r.category },
  { header: "Marque", value: (r) => r.brand?.name ?? r.brandFreeText },
  { header: "Modèle", value: (r) => r.model?.name ?? r.modelFreeText },
  { header: "Prix (DA)", value: (r) => r.price },
  { header: "Année", value: (r) => r.year },
  { header: "Kilométrage", value: (r) => r.mileage },
  { header: "Carburant", value: (r) => r.fuelType },
  { header: "Boîte", value: (r) => r.gearbox },
  { header: "État", value: (r) => r.condition },
  { header: "Couleur", value: (r) => r.color },
  { header: "Wilaya", value: (r) => r.wilaya.nomFr },
  { header: "Statut", value: (r) => r.status },
  { header: "Formule", value: (r) => r.formula },
  { header: "Score fraude", value: (r) => r.fraudScore },
  { header: "Vues", value: (r) => r.views },
  { header: "Négociable", value: (r) => r.negotiable },
  { header: "Vendeur", value: (r) => r.seller.profile?.displayName ?? r.seller.email },
  { header: "Email vendeur", value: (r) => r.seller.email },
  { header: "Créée le", value: (r) => r.createdAt.toISOString().slice(0, 10) },
  { header: "Publiée le", value: (r) => r.publishedAt?.toISOString().slice(0, 10) },
];

export const GET = apiHandler(async (request: NextRequest) => {
  const user = await requireRole(isModerator);
  if (user instanceof Response) return user;

  const url = new URL(request.url);
  const status = url.searchParams.get("status");

  const listings = await prisma.listing.findMany({
    where: status ? { status: status as never } : { status: { not: "BROUILLON" } },
    orderBy: { createdAt: "desc" },
    include: {
      brand: { select: { name: true } },
      model: { select: { name: true } },
      wilaya: { select: { nomFr: true } },
      seller: { select: { email: true, profile: { select: { displayName: true } } } },
    },
  });

  const csv = buildCsv(listings as unknown as Row[], COLUMNS);
  const suffix = status ? `-${status.toLowerCase()}` : "";
  return csvResponse(csv, `annonces${suffix}-${new Date().toISOString().slice(0, 10)}.csv`);
});
