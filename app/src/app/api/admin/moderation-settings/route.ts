import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { isAdmin } from "@/lib/auth-server/roles";
import { getModerationSettings, validateThreshold } from "@/lib/moderation-settings";
import { writeAuditLog } from "@/lib/audit-log";

const bodySchema = z.object({
  autoSuspendListingThreshold: z.number(),
  autoSuspendUserThreshold: z.number(),
});

// Lot 47 — réservé à ADMIN, jamais MODERATEUR : ce réglage change la
// politique de modération elle-même (même niveau de gravité que la gestion
// du référentiel marques/modèles, Lot 25), pas une action de modération au
// cas par cas.
export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation" }, { status: 400 });
  }

  const listingCheck = validateThreshold(parsed.data.autoSuspendListingThreshold);
  const userCheck = validateThreshold(parsed.data.autoSuspendUserThreshold);
  if (!listingCheck.ok || !userCheck.ok) {
    return NextResponse.json({ error: "invalid_threshold" }, { status: 400 });
  }

  const before = await getModerationSettings();

  const settings = await prisma.moderationSettings.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      autoSuspendListingThreshold: parsed.data.autoSuspendListingThreshold,
      autoSuspendUserThreshold: parsed.data.autoSuspendUserThreshold,
    },
    update: {
      autoSuspendListingThreshold: parsed.data.autoSuspendListingThreshold,
      autoSuspendUserThreshold: parsed.data.autoSuspendUserThreshold,
    },
  });

  await writeAuditLog({
    adminId: user.id,
    action: "moderation_settings.update",
    targetType: "ModerationSettings",
    targetId: "singleton",
    details: {
      before,
      after: {
        autoSuspendListingThreshold: settings.autoSuspendListingThreshold,
        autoSuspendUserThreshold: settings.autoSuspendUserThreshold,
      },
    },
  });

  return NextResponse.json({ settings });
}
