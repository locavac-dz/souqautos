// Lot 241 — supprime les notifications in-app de plus de 30 jours.
// Appelé chaque nuit par le cron sweep (/api/cron/sweep).
import { prisma } from "@/lib/prisma";

const TTL_DAYS = 30;

export async function sweepOldNotifications(now: Date = new Date()): Promise<void> {
  const cutoff = new Date(now.getTime() - TTL_DAYS * 24 * 60 * 60 * 1000);
  await prisma.userNotification.deleteMany({ where: { createdAt: { lt: cutoff } } });
}
