import { NextRequest, NextResponse } from "next/server";
import { requireUser, parseJsonBody } from "@/lib/api-route";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { canManageCollaborators } from "@/lib/pro-account";
import { serializeProPermissions } from "@/lib/pro-permissions";
import { checkRateLimit } from "@/lib/rate-limit";

const bodySchema = z.object({
  permissions: z.object({
    gererAnnonces: z.boolean().default(false),
    repondreAvis: z.boolean().default(false),
  }),
});

// Lot 42 — permet de modifier les permissions d'un collaborateur existant
// sans devoir le retirer puis le réajouter (utile maintenant que ce ne sont
// plus deux rôles fixes mais des cases indépendantes).
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; collaboratorId: string }> }
) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  // Vérification de débit avant tout accès DB (Lot 98, audit sécurité/qualité
  // — même raisonnement que collaborators/route.ts).
  if (!(await checkRateLimit(`edit-collaborator:${user.id}`, { limit: 30, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { id, collaboratorId } = await params;
  const account = await prisma.professionalAccount.findUnique({ where: { id } });
  if (!account) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!canManageCollaborators({ isOwner: account.userId === user.id, permissions: null })) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const collaborator = await prisma.proCollaborator.findUnique({ where: { id: collaboratorId } });
  if (!collaborator || collaborator.professionalAccountId !== id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const body = await parseJsonBody(request, bodySchema);
  if (body instanceof NextResponse) return body;

  const updated = await prisma.proCollaborator.update({
    where: { id: collaboratorId },
    data: { permissions: serializeProPermissions(body.permissions) },
  });

  return NextResponse.json({ collaborator: updated });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; collaboratorId: string }> }
) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  // Vérification de débit avant tout accès DB (Lot 98, audit sécurité/qualité
  // — même raisonnement que collaborators/route.ts).
  if (!(await checkRateLimit(`remove-collaborator:${user.id}`, { limit: 30, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { id, collaboratorId } = await params;
  const account = await prisma.professionalAccount.findUnique({ where: { id } });
  if (!account) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!canManageCollaborators({ isOwner: account.userId === user.id, permissions: null })) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const collaborator = await prisma.proCollaborator.findUnique({ where: { id: collaboratorId } });
  if (!collaborator || collaborator.professionalAccountId !== id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await prisma.proCollaborator.delete({ where: { id: collaboratorId } });

  return NextResponse.json({ ok: true });
}
