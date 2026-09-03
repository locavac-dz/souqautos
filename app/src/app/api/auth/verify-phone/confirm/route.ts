import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { checkPhoneCode } from "@/lib/verification";

const bodySchema = z.object({ code: z.string().trim().length(6) });

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation" }, { status: 400 });
  }

  const record = await prisma.phoneVerificationCode.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  if (!record) {
    return NextResponse.json({ error: "no_pending_code" }, { status: 400 });
  }

  const check = checkPhoneCode({
    submittedCode: parsed.data.code,
    storedCode: record.code,
    expiresAt: record.expiresAt,
    attempts: record.attempts,
  });

  if (!check.ok) {
    if (check.error === "invalid_code") {
      await prisma.phoneVerificationCode.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
    }
    return NextResponse.json({ error: check.error }, { status: 400 });
  }

  await prisma.user.update({ where: { id: user.id }, data: { phoneVerifiedAt: new Date() } });
  await prisma.phoneVerificationCode.delete({ where: { id: record.id } });

  return NextResponse.json({ ok: true });
}
