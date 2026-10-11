import { NextRequest, NextResponse } from "next/server";
import { apiHandler, requireUser, parseJsonBody } from "@/lib/api-route";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkPhoneCode } from "@/lib/verification";
import { checkRateLimit } from "@/lib/rate-limit";

const bodySchema = z.object({ code: z.string().trim().length(6) });

export const POST = apiHandler(async (request: NextRequest) => {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  if (!(await checkRateLimit(`verify-phone:confirm:${user.id}`, { limit: 10, windowMs: 15 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await parseJsonBody(request, bodySchema);
  if (body instanceof NextResponse) return body;

  const record = await prisma.phoneVerificationCode.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  if (!record) {
    return NextResponse.json({ error: "no_pending_code" }, { status: 400 });
  }

  const check = checkPhoneCode({
    submittedCode: body.code,
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
});
