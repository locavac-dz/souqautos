import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { getNotifications, getUnreadCount } from "@/lib/notification-service";

// GET /api/notifications — liste les 20 dernières notifications + badge count.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const [items, unreadCount] = await Promise.all([
    getNotifications(user.id),
    getUnreadCount(user.id),
  ]);

  return NextResponse.json({ items, unreadCount });
}
