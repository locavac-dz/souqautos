import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { isAdmin } from "@/lib/auth-server/roles";
import { refreshChargilyOrder } from "@/lib/chargily-events";

const bodySchema = z.object({
  kind: z.enum(["listing_formula", "pro_subscription"]),
  orderId: z.string().min(1).max(64),
});

// Lot 266 (audit B1) — « Relire chez Chargily » depuis /admin/paiements : l'admin n'avait aucun moyen de
// faire relire une commande Chargily restée en attente (la relecture était réservée à son auteur) et devait
// trancher à l'aveugle. Même transition que le webhook, tracée comme REFRESH_ADMIN. Réservé à ADMIN (argent).
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation" }, { status: 400 });
  }

  const result = await refreshChargilyOrder({
    kind: parsed.data.kind,
    orderId: parsed.data.orderId,
    now: new Date(),
    meta: { source: "REFRESH_ADMIN", actorUserId: user.id },
  });

  if (result.ok) {
    return NextResponse.json({ status: result.status, outcome: result.outcome, providerStatus: result.providerStatus });
  }
  switch (result.error) {
    case "not_found":
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    case "already_decided":
      return NextResponse.json({ status: result.status, outcome: "already_decided" });
    case "chargily_not_configured":
      return NextResponse.json({ error: "chargily_not_configured" }, { status: 503 });
    case "provider_unavailable":
      return NextResponse.json({ error: "provider_unavailable" }, { status: 502 });
  }
}
