import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { safeUser } from "@/lib/http";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  return NextResponse.json({
    user: {
      ...safeUser(user),
      profile: user.profile
        ? {
            displayName: user.profile.displayName,
            wilaya: user.profile.wilaya
              ? { id: user.profile.wilaya.id, nomFr: user.profile.wilaya.nomFr, nomAr: user.profile.wilaya.nomAr }
              : null,
          }
        : null,
    },
  });
}
