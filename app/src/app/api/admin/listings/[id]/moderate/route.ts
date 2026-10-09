import { NextRequest, NextResponse, after } from "next/server";
import { requireRole, parseJsonBody } from "@/lib/api-route";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isStaff } from "@/lib/auth-server/roles";
import { computeModerationTransition, type ModerationAction } from "@/lib/moderation";
import { writeAuditLog } from "@/lib/audit-log";
import { cancelPendingOrdersForListing } from "@/lib/payment-fulfillment";
import { broadcastPublication, notifySellerOfModeration, publicationData } from "@/lib/listing-publication";

const bodySchema = z.object({
  action: z.enum(["approve", "reject", "suspend"]),
  reason: z.string().trim().max(500).optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(isStaff);
  if (user instanceof NextResponse) return user;

  const { id } = await params;
  const body = await parseJsonBody(request, bodySchema);
  if (body instanceof NextResponse) return body;

  const listing = await prisma.listing.findUnique({ where: { id } });
  if (!listing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const action: ModerationAction = body.action;
  const transition = computeModerationTransition(listing.status, action, body.reason);
  if (!transition.ok) {
    return NextResponse.json({ error: transition.error }, { status: 400 });
  }

  const now = new Date();
  const isApproval = action === "approve";
  // Lot 272 — les champs d'une publication (expiration à la première publication, trace humaine/automatique)
  // viennent de listing-publication.ts, partagé avec la publication automatique.
  const data = isApproval
    ? publicationData(listing, now, { auto: false })
    : { status: transition.newStatus, moderationNote: body.reason?.trim() ?? null };

  // Deux membres du staff pourraient modérer la même annonce en même temps
  // (deux onglets, double-clic) : `findUnique` ci-dessus ne protège pas
  // contre cette course. `updateMany` filtré sur le statut LU (pas un
  // statut fixe : approve part d'EN_ATTENTE ou SUSPENDUE, suspend part de
  // PUBLIEE) est atomique — si `count` vaut 0, une autre requête a déjà
  // tranché entre-temps. Même correctif que sur PaymentOrder (Lot 69).
  const { count } = await prisma.listing.updateMany({ where: { id, status: listing.status }, data });
  if (count === 0) {
    return NextResponse.json({ error: "invalid_transition" }, { status: 400 });
  }
  const updatedListing = { ...listing, ...data };

  // Lot 265 — une annonce refusée ou suspendue ne doit pas être republiée par un paiement qui arriverait
  // ensuite : ses commandes EN_ATTENTE sont annulées (place libérée pour une nouvelle demande plus tard).
  if (!isApproval) {
    await cancelPendingOrdersForListing(prisma, id, `listing_${transition.newStatus.toLowerCase()}`, now);
  }

  if (isApproval) {
    // Lot 268 (audit B5) — une requête par alerte de recherche et un envoi par abonné : exécutés APRÈS la réponse à
    // l'admin, jamais dans sa requête (une base à quelques milliers d'alertes la faisait attendre plusieurs secondes).
    after(() => broadcastPublication(updatedListing));
  }

  // Écart trouvé en explorant le code (même famille que le Lot 62) : le
  // vendeur n'était jamais informé de l'issue de la modération — il ne
  // pouvait le découvrir qu'en revisitant lui-même « Mes annonces ».
  await notifySellerOfModeration({ listing, outcome: action, reason: body.reason });

  await writeAuditLog({
    adminId: user.id,
    action: `listing.${action}`,
    targetType: "Listing",
    targetId: id,
    details: {
      previousStatus: listing.status,
      newStatus: transition.newStatus,
      reason: body.reason ?? null,
    },
  });

  return NextResponse.json({ status: transition.newStatus });
}
