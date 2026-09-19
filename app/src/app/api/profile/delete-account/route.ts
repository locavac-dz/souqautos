import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { verifyPassword, hashPassword } from "@/lib/auth-server/password";
import { clearSessionCookie } from "@/lib/auth-server/session";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  generateAnonymizedEmail,
  ANONYMIZED_DISPLAY_NAME,
  ACCOUNT_DELETED_LISTING_NOTE,
} from "@/lib/account-deletion";

const bodySchema = z.object({ password: z.string().min(1) });

// Lot 51 — suppression de compte à la demande du titulaire. Anonymisation,
// jamais une suppression physique de la ligne User (cf. audit Lot 50 : la
// plupart des relations vers User sont en RESTRICT, une vraie suppression
// casserait l'historique de modération/avis/signalements que d'autres
// utilisateurs ont besoin de conserver). Réversibilité délibérément absente
// (contrairement à la suspension, Lot 31) : l'email/mot de passe d'origine
// sont irrémédiablement perdus.
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  if (!(await checkRateLimit(`delete-account:${user.id}`, { limit: 5, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation" }, { status: 400 });
  }

  if (!(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return NextResponse.json({ error: "wrong_password" }, { status: 400 });
  }

  const now = new Date();
  const unusableHash = await hashPassword(randomUUID());

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        email: generateAnonymizedEmail(user.id),
        passwordHash: unusableHash,
        phone: null,
        emailVerifiedAt: null,
        phoneVerifiedAt: null,
        identityVerifiedAt: null,
        deletedAt: now,
      },
    }),
    ...(user.profile
      ? [
          prisma.profile.update({
            where: { userId: user.id },
            data: { displayName: ANONYMIZED_DISPLAY_NAME, bio: null, avatarUrl: null, wilayaId: null },
          }),
        ]
      : []),
    // Lot 116 — les avis de propriétaire de la personne sont supprimés (avec les
    // signalements qui les visaient) : un texte personnel ne reste pas en ligne
    // sous un nom anonymisé, et n'aurait plus d'auteur pour le modifier.
    prisma.ownerReview.deleteMany({ where: { userId: user.id } }),
    // Retire du marché toute annonce encore active — un compte supprimé ne
    // peut plus jamais répondre à un acheteur ni compléter un brouillon.
    prisma.listing.updateMany({
      where: { sellerId: user.id, status: { in: ["BROUILLON", "EN_ATTENTE", "PUBLIEE"] } },
      data: { status: "SUSPENDUE", moderationNote: ACCOUNT_DELETED_LISTING_NOTE },
    }),
  ]);

  await clearSessionCookie();

  return NextResponse.json({ ok: true });
}
