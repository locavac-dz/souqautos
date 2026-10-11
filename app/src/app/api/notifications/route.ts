import { NextResponse } from "next/server";
import { apiHandler, requireUser } from "@/lib/api-route";
import { getNotifications, getUnreadCount } from "@/lib/notification-service";

// GET /api/notifications — liste les 20 dernières notifications + badge count.
export const GET = apiHandler(async () => {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const [items, unreadCount] = await Promise.all([
    getNotifications(user.id),
    getUnreadCount(user.id),
  ]);

  return NextResponse.json({ items, unreadCount });
});
