import { NextRequest, NextResponse } from "next/server";
import { apiHandler, parseJsonBody } from "@/lib/api-route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { checkRateLimit } from "@/lib/rate-limit";
import { proAccountFieldsSchema } from "@/lib/validation/pro-account";
import { shouldRevokeVerifiedBadge } from "@/lib/pro-account";

// Lot 106 — édition des informations de la boutique. Réservée au propriétaire
// (même règle que logo/bannière et gestion des collaborateurs). Remplacement
// complet des champs : un champ optionnel omis ou vide est effacé.
export const PATCH = apiHandler(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.professionalAccount?.id !== id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (!(await checkRateLimit(`update-pro-account:${user.id}`, { limit: 20, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await parseJsonBody(request, proAccountFieldsSchema);
  if (body instanceof NextResponse) return body;

  if (body.wilayaId) {
    const wilaya = await prisma.wilaya.findUnique({ where: { id: body.wilayaId } });
    if (!wilaya) {
      return NextResponse.json({ error: "validation" }, { status: 400 });
    }
  }

  const current = user.professionalAccount;
  const revokeBadge = shouldRevokeVerifiedBadge({
    badgeVerifie: current.badgeVerifie,
    currentName: current.nomCommercial,
    nextName: body.nomCommercial,
  });

  const { nomCommercial, presentation, horaires, phone, website, categoryPro, horairesSemaine, wilayaId } = body;

  const account = await prisma.professionalAccount.update({
    where: { id },
    data: {
      nomCommercial,
      presentation: presentation || null,
      // horaires only updated when explicitly sent (legacy text field, replaced by horairesSemaine)
      ...(horaires !== undefined ? { horaires: horaires || null } : {}),
      phone: phone || null,
      website: website || null,
      categoryPro: categoryPro ?? null,
      // undefined = not in body = do not touch existing value
      ...(horairesSemaine !== undefined ? { horairesSemaine } : {}),
      wilayaId: wilayaId ?? null,
      ...(revokeBadge ? { badgeVerifie: false } : {}),
    },
  });

  return NextResponse.json({ account, badgeRevoked: revokeBadge });
});
