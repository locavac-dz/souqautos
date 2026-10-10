import { NextRequest, NextResponse } from "next/server";
import { requireUser, parseJsonBody } from "@/lib/api-route";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { canManageCollaborators } from "@/lib/pro-account";
import { serializeProPermissions } from "@/lib/pro-permissions";
import { checkRateLimit } from "@/lib/rate-limit";
import { emailSchema } from "@/lib/validation/auth";
import { isUniqueViolation } from "@/lib/prisma-errors";

const bodySchema = z.object({
  email: emailSchema,
  permissions: z.object({
    gererAnnonces: z.boolean().default(false),
    repondreAvis: z.boolean().default(false),
  }),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  // Vérification de débit avant tout accès DB (même ordre que les autres
  // routes de l'application) : un appelant non autorisé sur cette ressource
  // n'échappe pas au rate limit en le faisant échouer après coup (Lot 98,
  // audit sécurité/qualité).
  if (!(await checkRateLimit(`add-collaborator:${user.id}`, { limit: 20, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { id } = await params;
  const account = await prisma.professionalAccount.findUnique({ where: { id } });
  if (!account) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!canManageCollaborators({ isOwner: account.userId === user.id, permissions: null })) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await parseJsonBody(request, bodySchema);
  if (body instanceof NextResponse) return body;

  const targetUser = await prisma.user.findUnique({ where: { email: body.email } });
  if (!targetUser) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }
  if (targetUser.id === account.userId) {
    return NextResponse.json({ error: "cannot_add_self" }, { status: 400 });
  }

  const existing = await prisma.proCollaborator.findUnique({
    where: { professionalAccountId_userId: { professionalAccountId: id, userId: targetUser.id } },
  });
  if (existing) {
    return NextResponse.json({ error: "already_collaborator" }, { status: 409 });
  }

  try {
    const collaborator = await prisma.proCollaborator.create({
      data: {
        professionalAccountId: id,
        userId: targetUser.id,
        permissions: serializeProPermissions(body.permissions),
      },
    });
    return NextResponse.json({ collaborator }, { status: 201 });
  } catch (error) {
    // Deux invitations simultanées du même compte : la base a déjà retenu l'une.
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: "already_collaborator" }, { status: 409 });
    }
    throw error;
  }
}
