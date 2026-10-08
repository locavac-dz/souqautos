import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { isAdmin } from "@/lib/auth-server/roles";
import { writeAuditLog } from "@/lib/audit-log";
import { activateListingFormula, sendListingFormulaDecisionEmail } from "@/lib/payment-fulfillment";

const bodySchema = z.object({
  action: z.enum(["approve", "reject"]),
  reason: z.string().trim().max(500).optional(),
});

// Réservé à ADMIN : un virement bancaire n'est jamais vérifié automatiquement
// (aucune API bancaire branchée) — seul un humain rapproche la référence
// fournie par le vendeur avec le relevé réel, même logique de confirmation
// humaine que la vérification d'identité (Lot 14). Plus sensible qu'une
// action de modération courante (argent réel), donc pas ouvert à MODERATEUR.
// Lot 264 : une commande Chargily EN_ATTENTE (webhook jamais arrivé) peut aussi être tranchée ici,
// après vérification dans le tableau de bord Chargily — l'activation est la même (payment-fulfillment).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation" }, { status: 400 });
  }

  if (parsed.data.action === "reject" && !parsed.data.reason?.trim()) {
    return NextResponse.json({ error: "reason_required" }, { status: 400 });
  }

  const order = await prisma.paymentOrder.findUnique({
    where: { id },
    include: { listing: true, user: true },
  });
  if (!order) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (order.status !== "EN_ATTENTE") {
    return NextResponse.json({ error: "invalid_transition" }, { status: 400 });
  }

  const now = new Date();
  const isApproval = parsed.data.action === "approve";

  // Deux admins pourraient approuver/refuser la même demande en même temps
  // (deux onglets, double-clic) : le `findUnique` ci-dessus ne protège pas
  // contre cette course. `updateMany` avec le statut EN_ATTENTE dans le
  // `where` est atomique — si une autre requête a déjà tranché entre-temps,
  // `count` vaut 0 et on s'arrête avant d'appliquer deux fois la formule ou
  // d'envoyer deux fois l'email.
  const { count } = await prisma.paymentOrder.updateMany({
    where: { id, status: "EN_ATTENTE" },
    data: {
      status: isApproval ? "CONFIRMEE" : "REJETEE",
      reviewedById: user.id,
      reviewedAt: now,
      reviewNote: parsed.data.reason?.trim() || null,
    },
  });
  if (count === 0) {
    return NextResponse.json({ error: "invalid_transition" }, { status: 400 });
  }

  if (isApproval) {
    await activateListingFormula(order.listing, order.formula, now);
  }

  await writeAuditLog({
    adminId: user.id,
    action: `payment_order.${parsed.data.action}`,
    targetType: "PaymentOrder",
    targetId: id,
    details: {
      listingId: order.listingId,
      formula: order.formula,
      amountDzd: order.amountDzd,
      provider: order.provider,
      reference: order.reference,
      reason: parsed.data.reason ?? null,
    },
  });

  await sendListingFormulaDecisionEmail(
    order.user,
    order.listing,
    isApproval
      ? { approved: true, source: order.provider === "CHARGILY" ? "chargily" : "virement" }
      : { approved: false, reason: parsed.data.reason?.trim() ?? "" }
  );

  return NextResponse.json({ status: isApproval ? "CONFIRMEE" : "REJETEE" });
}
