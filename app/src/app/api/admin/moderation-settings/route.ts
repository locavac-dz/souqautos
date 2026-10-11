import { NextRequest, NextResponse } from "next/server";
import { apiHandler, requireRole, parseJsonBody } from "@/lib/api-route";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth-server/roles";
import { getModerationSettings, validateMinApprovedListings, validateThreshold } from "@/lib/moderation-settings";
import { writeAuditLog } from "@/lib/audit-log";

const bodySchema = z.object({
  autoSuspendListingThreshold: z.number(),
  autoSuspendUserThreshold: z.number(),
  // Lot 272 — facultatifs : un client qui n'envoie que les seuils ne touche pas à la publication automatique.
  autoPublishEnabled: z.boolean().optional(),
  autoPublishMinApprovedListings: z.number().optional(),
});

// Lot 47 — réservé à ADMIN, jamais MODERATEUR : ce réglage change la
// politique de modération elle-même (même niveau de gravité que la gestion
// du référentiel marques/modèles, Lot 25), pas une action de modération au
// cas par cas.
export const PATCH = apiHandler(async (request: NextRequest) => {
  const user = await requireRole(isAdmin);
  if (user instanceof NextResponse) return user;

  const body = await parseJsonBody(request, bodySchema);
  if (body instanceof NextResponse) return body;

  const listingCheck = validateThreshold(body.autoSuspendListingThreshold);
  const userCheck = validateThreshold(body.autoSuspendUserThreshold);
  if (!listingCheck.ok || !userCheck.ok) {
    return NextResponse.json({ error: "invalid_threshold" }, { status: 400 });
  }
  if (body.autoPublishMinApprovedListings !== undefined) {
    const minCheck = validateMinApprovedListings(body.autoPublishMinApprovedListings);
    if (!minCheck.ok) {
      return NextResponse.json({ error: minCheck.error }, { status: 400 });
    }
  }

  const before = await getModerationSettings();
  const next = {
    autoSuspendListingThreshold: body.autoSuspendListingThreshold,
    autoSuspendUserThreshold: body.autoSuspendUserThreshold,
    autoPublishEnabled: body.autoPublishEnabled ?? before.autoPublishEnabled,
    autoPublishMinApprovedListings: body.autoPublishMinApprovedListings ?? before.autoPublishMinApprovedListings,
  };

  const settings = await prisma.moderationSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...next },
    update: next,
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
        autoPublishEnabled: settings.autoPublishEnabled,
        autoPublishMinApprovedListings: settings.autoPublishMinApprovedListings,
      },
    },
  });

  return NextResponse.json({ settings });
});
