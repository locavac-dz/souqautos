import { NextRequest, NextResponse } from "next/server";
import { apiHandler, requireRole } from "@/lib/api-route";
import { isAdmin } from "@/lib/auth-server/roles";
import { resetTwoFactor } from "@/lib/two-factor";

// Lot 138 — récupération : une personne qui a perdu son téléphone ET ses codes de secours. Réservé aux ADMINISTRATEURS (un
// modérateur ne peut pas retirer la protection d'un compte), jamais sur son propre compte (pour cela : `npm run auth:reset-2fa`,
// qui exige l'accès au serveur — une session ouverte ne suffit pas à se retirer sa propre protection).
export const POST = apiHandler(async (_request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireRole(isAdmin);
  if (user instanceof NextResponse) return user;

  const { id } = await params;
  if (id === user.id) return NextResponse.json({ error: "self" }, { status: 400 });

  const result = await resetTwoFactor(id, user.id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.error === "not_found" ? 404 : 409 });
  return NextResponse.json({ ok: true });
});
