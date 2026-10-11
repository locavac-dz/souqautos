import { NextRequest, NextResponse } from "next/server";
import { apiHandler, requireUser, parseJsonBody, NO_STORE } from "@/lib/api-route";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { canManageListing } from "@/lib/listing-access";
import { isUniqueViolation } from "@/lib/prisma-errors";
import { prospectUpdateSchema } from "@/lib/prospects";

// Lot 123 — modifier le statut et/ou la note privée d'un prospect (une conversation d'un compte pro).
export const PATCH = apiHandler(async (request: NextRequest, { params }: { params: Promise<{ conversationId: string }> }) => {
  const user = await requireUser({ headers: NO_STORE });
  if (user instanceof NextResponse) return user;

  if (!(await checkRateLimit(`prospect-update:${user.id}`, { limit: 200, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: NO_STORE });
  }

  const body = await parseJsonBody(request, prospectUpdateSchema, { headers: NO_STORE });
  if (body instanceof NextResponse) return body;

  const { conversationId } = await params;
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId }, select: { id: true, sellerId: true } });

  // Même réponse « introuvable » pour une conversation inexistante et pour une conversation
  // à laquelle on n'a pas accès : on ne révèle pas son existence. Il faut être le vendeur ou un
  // collaborateur autorisé à gérer ses annonces (comme pour lire la conversation), et le vendeur
  // doit avoir un compte professionnel : le suivi des prospects est un outil pro.
  const allowed =
    conversation !== null &&
    (await canManageListing(user.id, conversation.sellerId)) &&
    (await prisma.professionalAccount.findUnique({ where: { userId: conversation.sellerId }, select: { id: true } })) !== null;
  if (!conversation || !allowed) {
    return NextResponse.json({ error: "not_found" }, { status: 404, headers: NO_STORE });
  }

  // Seuls les champs envoyés changent : envoyer le statut seul ne touche pas à la note.
  const data = {
    ...(body.status !== undefined ? { status: body.status } : {}),
    ...(body.note !== undefined ? { note: body.note } : {}),
    updatedById: user.id,
  };

  const write = () =>
    prisma.prospectFollowUp.upsert({
      where: { conversationId: conversation.id },
      create: { conversationId: conversation.id, ...data },
      update: data,
      select: { status: true, note: true, updatedAt: true },
    });

  let saved;
  try {
    saved = await write();
  } catch (error) {
    // Deux enregistrements simultanés d'un prospect encore sans suivi : le second devient une mise à jour.
    if (!isUniqueViolation(error)) throw error;
    saved = await write();
  }

  return NextResponse.json({ status: saved.status, note: saved.note, updatedAt: saved.updatedAt }, { headers: NO_STORE });
});
