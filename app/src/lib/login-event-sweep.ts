import { prisma } from "@/lib/prisma";

const TTL_DAYS = 90;

export async function sweepOldLoginEvents(now: Date = new Date()): Promise<void> {
  const cutoff = new Date(now.getTime() - TTL_DAYS * 24 * 60 * 60 * 1000);
  await prisma.loginEvent.deleteMany({ where: { createdAt: { lt: cutoff } } });
}
