import { prisma } from "@/lib/prisma";

export async function writeAuditLog(entry: {
  adminId: string;
  action: string;
  targetType: string;
  targetId: string;
  details?: Record<string, unknown>;
}) {
  await prisma.auditLog.create({
    data: {
      adminId: entry.adminId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      details: entry.details ? JSON.stringify(entry.details) : null,
    },
  });
}
