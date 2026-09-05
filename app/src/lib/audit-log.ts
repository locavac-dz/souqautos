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

// Reprend le JSON libre stocké par writeAuditLog en une ligne lisible pour le
// journal d'audit (/admin/journal) — jamais un rendu JSON brut à l'écran.
export function formatAuditLogDetails(details: string | null): string {
  if (!details) return "—";
  try {
    const parsed = JSON.parse(details) as Record<string, unknown>;
    return Object.entries(parsed)
      .filter(([, value]) => value !== null && value !== undefined)
      .map(([key, value]) => `${key}: ${value}`)
      .join(" · ");
  } catch {
    return details;
  }
}
