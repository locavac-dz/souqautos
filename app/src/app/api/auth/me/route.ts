import { NextResponse } from "next/server";
import { apiHandler, requireUser } from "@/lib/api-route";
import { safeUser } from "@/lib/http";

export const GET = apiHandler(async () => {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
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
});
