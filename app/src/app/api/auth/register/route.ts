import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validation/auth";
import { hashPassword } from "@/lib/auth-server/password";
import { createSessionToken, setSessionCookie } from "@/lib/auth-server/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp, safeUser } from "@/lib/http";

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  if (!checkRateLimit(`register:${ip}`, { limit: 10, windowMs: 15 * 60 * 1000 })) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { displayName, email, password, wilayaId } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "email_taken" }, { status: 409 });
  }

  if (wilayaId) {
    const wilaya = await prisma.wilaya.findUnique({ where: { id: wilayaId } });
    if (!wilaya) {
      return NextResponse.json(
        { error: "validation", issues: [{ path: ["wilayaId"], message: "Wilaya inconnue" }] },
        { status: 400 }
      );
    }
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      profile: {
        create: {
          displayName,
          wilayaId: wilayaId ?? null,
        },
      },
    },
  });

  const token = await createSessionToken({ sub: user.id, role: user.role });
  await setSessionCookie(token);

  return NextResponse.json({ user: safeUser(user) }, { status: 201 });
}
