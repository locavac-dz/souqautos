import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { checkRateLimit } from "@/lib/rate-limit";
import { proAccountFieldsSchema as bodySchema } from "@/lib/validation/pro-account";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (user.professionalAccount) {
    return NextResponse.json({ error: "already_professional" }, { status: 400 });
  }

  if (!(await checkRateLimit(`create-pro-account:${user.id}`, { limit: 5, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation" }, { status: 400 });
  }

  if (parsed.data.wilayaId) {
    const wilaya = await prisma.wilaya.findUnique({ where: { id: parsed.data.wilayaId } });
    if (!wilaya) {
      return NextResponse.json({ error: "validation" }, { status: 400 });
    }
  }

  const account = await prisma.$transaction(async (tx) => {
    const created = await tx.professionalAccount.create({
      data: {
        userId: user.id,
        nomCommercial: parsed.data.nomCommercial,
        presentation: parsed.data.presentation || null,
        horaires: parsed.data.horaires || null,
        wilayaId: parsed.data.wilayaId ?? null,
      },
    });
    await tx.user.update({ where: { id: user.id }, data: { role: "PROFESSIONNEL" } });
    return created;
  });

  return NextResponse.json({ account }, { status: 201 });
}
