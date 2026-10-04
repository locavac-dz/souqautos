import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { markAllRead } from "@/lib/notification-service";

// PATCH /api/notifications/read-all — marque toutes les notifications comme lues.
export async function PATCH() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  await markAllRead(user.id);
  return NextResponse.json({ ok: true });
}
