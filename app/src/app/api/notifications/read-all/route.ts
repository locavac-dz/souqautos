import { NextResponse } from "next/server";
import { apiHandler, requireUser } from "@/lib/api-route";
import { markAllRead } from "@/lib/notification-service";

// PATCH /api/notifications/read-all — marque toutes les notifications comme lues.
export const PATCH = apiHandler(async () => {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  await markAllRead(user.id);
  return NextResponse.json({ ok: true });
});
