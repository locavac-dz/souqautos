import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { isAdmin } from "@/lib/auth-server/roles";
import { resetTwoFactor } from "@/lib/two-factor";

// Lot 138 — récupération : une personne qui a perdu son téléphone ET ses codes de secours. Réservé aux ADMINISTRATEURS (un
// modérateur ne peut pas retirer la protection d'un compte), jamais sur son propre compte (pour cela : `npm run auth:reset-2fa`,
// qui exige l'accès au serveur — une session ouverte ne suffit pas à se retirer sa propre protection).
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  if (id === user.id) return NextResponse.json({ error: "self" }, { status: 400 });

  const result = await resetTwoFactor(id, user.id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.error === "not_found" ? 404 : 409 });
  return NextResponse.json({ ok: true });
}
