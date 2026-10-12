import { apiHandler, requireRole } from "@/lib/api-route";
import { isModerator } from "@/lib/auth-server/roles";
import { prisma } from "@/lib/prisma";
import { buildCsv, csvResponse, type CsvColumn } from "@/lib/csv-export";

type Row = {
  id: string;
  email: string;
  phone: string | null;
  role: string;
  locale: string;
  profile: { displayName: string | null; wilaya: { nomFr: string } | null } | null;
  emailVerifiedAt: Date | null;
  createdAt: Date;
  suspendedAt: Date | null;
  deletedAt: Date | null;
  totpEnabledAt: Date | null;
  _count: { listings: number };
};

const COLUMNS: CsvColumn<Row>[] = [
  { header: "ID", value: (r) => r.id },
  { header: "Email", value: (r) => r.email },
  { header: "Téléphone", value: (r) => r.phone },
  { header: "Nom affiché", value: (r) => r.profile?.displayName },
  { header: "Rôle", value: (r) => r.role },
  { header: "Wilaya", value: (r) => r.profile?.wilaya?.nomFr },
  { header: "Langue", value: (r) => r.locale },
  { header: "Email vérifié", value: (r) => r.emailVerifiedAt != null },
  { header: "2FA actif", value: (r) => r.totpEnabledAt != null },
  { header: "Nb annonces", value: (r) => r._count.listings },
  { header: "Inscrit le", value: (r) => r.createdAt.toISOString().slice(0, 10) },
  { header: "Suspendu le", value: (r) => r.suspendedAt?.toISOString().slice(0, 10) },
  { header: "Supprimé le", value: (r) => r.deletedAt?.toISOString().slice(0, 10) },
];

export const GET = apiHandler(async () => {
  const user = await requireRole(isModerator);
  if (user instanceof Response) return user;

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      profile: { select: { displayName: true, wilaya: { select: { nomFr: true } } } },
      _count: { select: { listings: true } },
    },
  });

  const csv = buildCsv(users as unknown as Row[], COLUMNS);
  return csvResponse(csv, `utilisateurs-${new Date().toISOString().slice(0, 10)}.csv`);
});
