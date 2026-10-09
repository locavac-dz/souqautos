import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireUser, parseJsonBody } from "@/lib/api-route";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword, hashPassword } from "@/lib/auth-server/password";
import { clearSessionCookie } from "@/lib/auth-server/session";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  generateAnonymizedEmail,
  ANONYMIZED_DISPLAY_NAME,
  ACCOUNT_DELETED_LISTING_NOTE,
} from "@/lib/account-deletion";

// Lot 132 — un compte créé avec Google n'a pas de mot de passe : il confirme la suppression en saisissant son adresse
// e-mail. Un compte qui a un mot de passe doit toujours le donner (`confirmEmail` ne le remplace jamais).
const bodySchema = z.object({ password: z.string().min(1).optional(), confirmEmail: z.string().min(1).max(255).optional() });

// Lot 51 — suppression de compte à la demande du titulaire. Anonymisation,
// jamais une suppression physique de la ligne User (cf. audit Lot 50 : la
// plupart des relations vers User sont en RESTRICT, une vraie suppression
// casserait l'historique de modération/avis/signalements que d'autres
// utilisateurs ont besoin de conserver). Réversibilité délibérément absente
// (contrairement à la suspension, Lot 31) : l'email/mot de passe d'origine
// sont irrémédiablement perdus.
export async function POST(request: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  if (!(await checkRateLimit(`delete-account:${user.id}`, { limit: 5, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await parseJsonBody(request, bodySchema);
  if (body instanceof NextResponse) return body;

  if (user.passwordHash) {
    if (!body.password || !(await verifyPassword(body.password, user.passwordHash))) {
      return NextResponse.json({ error: "wrong_password" }, { status: 400 });
    }
  } else if (body.confirmEmail?.trim().toLowerCase() !== user.email.toLowerCase()) {
    return NextResponse.json({ error: "wrong_confirmation" }, { status: 400 });
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
    // Lot 132 — le lien avec le compte Google est rompu : sans cela, la même personne (ou quiconque contrôlerait ce
    // compte Google) se reconnecterait dans le compte anonymisé.
    prisma.oAuthAccount.deleteMany({ where: { userId: user.id } }),
    // Lot 133 — un lien de réinitialisation encore valable ne doit pas survivre au compte.
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
    // Retire du marché toute annonce encore active — un compte supprimé ne
    // peut plus jamais répondre à un acheteur ni compléter un brouillon.
    prisma.listing.updateMany({
      where: { sellerId: user.id, status: { in: ["BROUILLON", "EN_ATTENTE", "PUBLIEE"] } },
      data: { status: "SUSPENDUE", moderationNote: ACCOUNT_DELETED_LISTING_NOTE },
    }),
    // Lot 265 — un paiement de formule ou d'abonnement qui arriverait après la suppression ne doit rien
    // activer au nom d'un compte anonymisé : commandes EN_ATTENTE annulées.
    prisma.paymentOrder.updateMany({
      where: { userId: user.id, status: "EN_ATTENTE" },
      data: { status: "ANNULEE", reviewNote: "account_deleted", reviewedAt: now },
    }),
    prisma.proSubscriptionOrder.updateMany({
      where: { userId: user.id, status: "EN_ATTENTE" },
      data: { status: "ANNULEE", reviewNote: "account_deleted", reviewedAt: now },
    }),
  ]);

  await clearSessionCookie();

  return NextResponse.json({ ok: true });
}
