// Lot 241 — service de notifications in-app.
// Chaque notification est un enregistrement léger : kind + data JSON + readAt.
// Le champ `data` contient a minima `{ url, body }` — URL de destination et texte
// court (déjà traduit par l'appelant dans la locale de l'utilisateur cible).
// La lecture de `data` côté affichage est typée par le kind : cf. NotificationData.
import { prisma } from "@/lib/prisma";
import type { NotificationKind } from "@prisma/client";

export type NotificationData = {
  url: string;
  body: string;
  title?: string;
};

export type NotificationItem = {
  id: string;
  kind: NotificationKind;
  data: NotificationData;
  readAt: Date | null;
  createdAt: Date;
};

const NOTIFICATIONS_PER_PAGE = 20;

export async function createNotification(
  userId: string,
  kind: NotificationKind,
  data: NotificationData
): Promise<void> {
  try {
    await prisma.userNotification.create({ data: { userId, kind, data } });
  } catch (err) {
    // Une notification qui échoue ne doit jamais bloquer l'action principale.
    console.error(`[notification-service] création échouée (${kind}): ${(err as Error).message}`);
  }
}

export async function getNotifications(
  userId: string,
  limit = NOTIFICATIONS_PER_PAGE
): Promise<NotificationItem[]> {
  const rows = await prisma.userNotification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    data: r.data as NotificationData,
    readAt: r.readAt,
    createdAt: r.createdAt,
  }));
}

export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.userNotification.count({ where: { userId, readAt: null } });
}

export async function markAllRead(userId: string): Promise<void> {
  await prisma.userNotification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function markRead(userId: string, id: string): Promise<void> {
  await prisma.userNotification.updateMany({
    where: { id, userId, readAt: null },
    data: { readAt: new Date() },
  });
}
