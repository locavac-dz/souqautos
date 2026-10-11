import { NextRequest, NextResponse } from "next/server";
import { apiHandler, parseJsonBody } from "@/lib/api-route";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validation/auth";
import { hashPassword } from "@/lib/auth-server/password";
import { createSessionToken, setSessionCookie } from "@/lib/auth-server/session";
import { createRefreshSession, setRefreshCookie } from "@/lib/auth-server/refresh-token";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp, safeUser } from "@/lib/http";
import { isUniqueViolation } from "@/lib/prisma-errors";

export const POST = apiHandler(async (request: NextRequest) => {
  const ip = getClientIp(request);
  if (!(await checkRateLimit(`register:${ip}`, { limit: 10, windowMs: 15 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await parseJsonBody(request, registerSchema, { issues: "full" });
  if (body instanceof NextResponse) return body;

  const { displayName, email, password, wilayaId } = body;

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

  let user;
  try {
    user = await prisma.user.create({
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
  } catch (error) {
    // Deux inscriptions simultanées avec la même adresse : la vérification
    // ci-dessus les a laissées passer toutes les deux, la base n'en retient qu'une.
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: "email_taken" }, { status: 409 });
    }
    throw error;
  }

  const token = await createSessionToken({ sub: user.id, role: user.role });
  await setSessionCookie(token);
  const userAgent = request.headers.get("user-agent") ?? "";
  const refreshToken = await createRefreshSession(user.id, { ip, userAgent });
  await setRefreshCookie(refreshToken);

  return NextResponse.json({ user: safeUser(user) }, { status: 201 });
});
