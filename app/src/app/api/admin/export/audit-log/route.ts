import { NextRequest } from "next/server";
import { apiHandler, requireRole } from "@/lib/api-route";
import { isModerator } from "@/lib/auth-server/roles";
import { prisma } from "@/lib/prisma";
import { buildCsv, csvResponse, type CsvColumn } from "@/lib/csv-export";

type Row = {
  id: string;
  admin: { email: string } | null;
  action: string;
  targetType: string;
  targetId: string;
  details: string | null;
  createdAt: Date;
};

const COLUMNS: CsvColumn<Row>[] = [
  { header: "Date", value: (r) => r.createdAt.toISOString().replace("T", " ").slice(0, 19) },
  { header: "Admin", value: (r) => r.admin?.email ?? "Système" },
  { header: "Action", value: (r) => r.action },
  { header: "Type cible", value: (r) => r.targetType },
  { header: "ID cible", value: (r) => r.targetId },
  { header: "Détails", value: (r) => r.details },
];

export const GET = apiHandler(async (request: NextRequest) => {
  const user = await requireRole(isModerator);
  if (user instanceof Response) return user;

  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const where: Record<string, unknown> = {};
  if (from || to) {
    const createdAt: Record<string, Date> = {};
    if (from) createdAt.gte = new Date(from);
    if (to) createdAt.lte = new Date(to + "T23:59:59.999Z");
    where.createdAt = createdAt;
  }

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { admin: { select: { email: true } } },
  });

  const csv = buildCsv(logs as unknown as Row[], COLUMNS);
  return csvResponse(csv, `journal-audit-${new Date().toISOString().slice(0, 10)}.csv`);
});
