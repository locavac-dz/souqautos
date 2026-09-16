import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validation/auth";
import { verifyPassword, DUMMY_PASSWORD_HASH } from "@/lib/auth-server/password";
import { createSessionToken, setSessionCookie } from "@/lib/auth-server/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp, safeUser } from "@/lib/http";

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  if (!(await checkRateLimit(`login:${ip}`, { limit: 10, windowMs: 15 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  // bcrypt.compare() toujours exécuté, même si le compte n'existe pas (contre
  // DUMMY_PASSWORD_HASH) — jamais un court-circuit `!user || ...` qui
  // sauterait l'appel bcrypt, ce qui rendrait la réponse mesurablement plus
  // rapide pour un email inconnu et permettrait d'énumérer les comptes
  // existants par le temps de réponse (Lot 98, audit sécurité). Même message
  // générique dans les deux cas — ne jamais révéler l'existence d'un compte.
  const passwordValid = await verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
  if (!user || !passwordValid) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  if (user.suspendedAt) {
    return NextResponse.json(
      { error: "account_suspended", reason: user.suspensionReason },
      { status: 403 }
    );
  }

  const token = await createSessionToken({ sub: user.id, role: user.role });
  await setSessionCookie(token);

  return NextResponse.json({ user: safeUser(user) });
}
