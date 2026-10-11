import { NextRequest, NextResponse } from "next/server";
import { apiHandler, requireUser, parseJsonBody } from "@/lib/api-route";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { isUniqueViolation } from "@/lib/prisma-errors";
import { proAccountFieldsSchema as bodySchema } from "@/lib/validation/pro-account";

export const POST = apiHandler(async (request: NextRequest) => {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  if (user.professionalAccount) {
    return NextResponse.json({ error: "already_professional" }, { status: 409 });
  }

  if (!(await checkRateLimit(`create-pro-account:${user.id}`, { limit: 5, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await parseJsonBody(request, bodySchema);
  if (body instanceof NextResponse) return body;

  if (body.wilayaId) {
    const wilaya = await prisma.wilaya.findUnique({ where: { id: body.wilayaId } });
    if (!wilaya) {
      return NextResponse.json({ error: "validation" }, { status: 400 });
    }
  }

  try {
    const account = await prisma.$transaction(async (tx) => {
      const created = await tx.professionalAccount.create({
        data: {
          userId: user.id,
          nomCommercial: body.nomCommercial,
          presentation: body.presentation || null,
          horaires: body.horaires || null,
          wilayaId: body.wilayaId ?? null,
        },
      });
      await tx.user.update({ where: { id: user.id }, data: { role: "PROFESSIONNEL" } });
      return created;
    });

    return NextResponse.json({ account }, { status: 201 });
  } catch (error) {
    // Double envoi du formulaire : un seul compte pro par utilisateur, la
    // transaction de l'autre requête est annulée.
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: "already_professional" }, { status: 409 });
    }
    throw error;
  }
});
