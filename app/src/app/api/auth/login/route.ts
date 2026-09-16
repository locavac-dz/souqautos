import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validation/auth";
import { verifyPassword, DUMMY_PASSWORD_HASH } from "@/lib/auth-server/password";
import { createSessionToken, setSessionCookie } from "@/lib/auth-server/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp, safeUser } from "@/lib/http";
import { isAccountLocked, computeFailedLoginUpdate } from "@/lib/login-lockout";

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
  const now = new Date();
  const locked = user ? isAccountLocked(user.lockedUntil, now) : false;

  // bcrypt.compare() toujours exécuté, même si le compte n'existe pas ou est
  // verrouillé (contre DUMMY_PASSWORD_HASH dans les deux cas) — jamais un
  // court-circuit qui sauterait l'appel bcrypt, ce qui rendrait la réponse
  // mesurablement plus rapide et permettrait d'énumérer les comptes
  // existants/verrouillés par le temps de réponse (Lot 98, audit sécurité).
  const passwordValid = await verifyPassword(
    password,
    !user || locked ? DUMMY_PASSWORD_HASH : user.passwordHash
  );

  if (!user) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  if (locked) {
    // Ne confirme jamais si le mot de passe était correct pendant le
    // verrouillage — jamais un indice sur la validité du mot de passe tant
    // que le compte reste verrouillé.
    return NextResponse.json(
      { error: "account_locked", lockedUntil: user.lockedUntil },
      { status: 423 }
    );
  }

  if (!passwordValid) {
    const update = computeFailedLoginUpdate(user.failedLoginAttempts, now);
    await prisma.user.update({ where: { id: user.id }, data: update });
    if (update.lockedUntil) {
      console.warn(`[auth] Compte verrouillé après ${update.failedLoginAttempts} échecs : ${user.email}`);
    }
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  if (user.suspendedAt) {
    return NextResponse.json(
      { error: "account_suspended", reason: user.suspensionReason },
      { status: 403 }
    );
  }

  // Connexion réussie : réinitialise le compteur d'échecs.
  if (user.failedLoginAttempts > 0) {
    await prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockedUntil: null } });
  }

  const token = await createSessionToken({ sub: user.id, role: user.role });
  await setSessionCookie(token);

  return NextResponse.json({ user: safeUser(user) });
}
