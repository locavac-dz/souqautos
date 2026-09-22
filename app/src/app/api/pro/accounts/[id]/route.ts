import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { checkRateLimit } from "@/lib/rate-limit";
import { proAccountFieldsSchema } from "@/lib/validation/pro-account";
import { shouldRevokeVerifiedBadge } from "@/lib/pro-account";

// Lot 106 — édition des informations de la boutique. Réservée au propriétaire
// (même règle que logo/bannière et gestion des collaborateurs). Remplacement
// complet des champs : un champ optionnel omis ou vide est effacé.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.professionalAccount?.id !== id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (!(await checkRateLimit(`update-pro-account:${user.id}`, { limit: 20, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = proAccountFieldsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation" }, { status: 400 });
  }

  if (parsed.data.wilayaId) {
    const wilaya = await prisma.wilaya.findUnique({ where: { id: parsed.data.wilayaId } });
    if (!wilaya) {
      return NextResponse.json({ error: "validation" }, { status: 400 });
    }
  }

  const current = user.professionalAccount;
  const revokeBadge = shouldRevokeVerifiedBadge({
    badgeVerifie: current.badgeVerifie,
    currentName: current.nomCommercial,
    nextName: parsed.data.nomCommercial,
  });

  const account = await prisma.professionalAccount.update({
    where: { id },
    data: {
      nomCommercial: parsed.data.nomCommercial,
      presentation: parsed.data.presentation || null,
      horaires: parsed.data.horaires || null,
      phone: parsed.data.phone || null,
      website: parsed.data.website || null,
      categoryPro: parsed.data.categoryPro ?? null,
      wilayaId: parsed.data.wilayaId ?? null,
      ...(revokeBadge ? { badgeVerifie: false } : {}),
    },
  });

  return NextResponse.json({ account, badgeRevoked: revokeBadge });
}
