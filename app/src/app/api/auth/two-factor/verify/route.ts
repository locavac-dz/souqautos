import { NextRequest, NextResponse, after } from "next/server";
import { parseJsonBody, NO_STORE } from "@/lib/api-route";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { clearPendingCookie, getPendingFromCookies } from "@/lib/auth-server/two-factor-pending";
import { createSessionToken, setSessionCookie } from "@/lib/auth-server/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp, safeUser } from "@/lib/http";
import { recordLoginEvent } from "@/lib/login-event-service";
import { LOGIN_ACCOUNT_LIMIT, isAccountLocked, lockedUntilForAttempts } from "@/lib/login-lockout";
import { sanitizeNextPath } from "@/lib/google-oauth";
import { challenge } from "@/lib/two-factor";

// Lot 138 — seconde étape de la connexion : le code de l'application (ou un code de secours). C'est ICI, et seulement ici, que la
// session est créée pour un compte qui a la double authentification.
//
// Freins, du plus large au plus étroit :
//  - par adresse IP (30 essais / 15 min) ;
//  - par compte, quelle que soit l'adresse (LOGIN_ACCOUNT_LIMIT, comme la connexion) ;
//  - le verrouillage du compte (5 échecs, 15 min) : chaque code faux compte comme un mot de passe faux, et le compteur n'est remis
//    à zéro QU'ICI, après un code valable — jamais par la simple saisie du bon mot de passe (voir la route de connexion).
const schema = z.object({ code: z.string().trim().min(1).max(40) });

export async function POST(request: NextRequest) {
  if (!(await checkRateLimit(`2fa-verify:${getClientIp(request)}`, { limit: 30, windowMs: 15 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: NO_STORE });
  }

  const pending = await getPendingFromCookies();
  if (!pending) return NextResponse.json({ error: "no_pending" }, { status: 401, headers: NO_STORE });

  if (!(await checkRateLimit(`2fa-account:${pending.sub}`, LOGIN_ACCOUNT_LIMIT))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: NO_STORE });
  }

  const body = await parseJsonBody(request, schema, { headers: NO_STORE });
  if (body instanceof NextResponse) return body;

  const user = await prisma.user.findUnique({ where: { id: pending.sub } });
  // Compte supprimé ou suspendu depuis la première étape : la connexion en attente ne vaut plus rien.
  if (!user || user.deletedAt || user.suspendedAt) {
    await clearPendingCookie();
    return NextResponse.json({ error: "no_pending" }, { status: 401, headers: NO_STORE });
  }

  const now = new Date();
  if (isAccountLocked(user.lockedUntil, now)) {
    return NextResponse.json({ error: "account_locked", lockedUntil: user.lockedUntil }, { status: 423, headers: NO_STORE });
  }

  const result = await challenge(user.id, body.code, now);
  if (!result.ok) {
    if (result.error === "not_enabled") {
      // La fonction a été désactivée entre-temps (réinitialisation par l'équipe) : il suffit de se reconnecter.
      await clearPendingCookie();
      return NextResponse.json({ error: "no_pending" }, { status: 401, headers: NO_STORE });
    }
    // Incrément fait PAR LA BASE (comme pour un mot de passe faux) : des essais simultanés comptent tous.
    const { failedLoginAttempts } = await prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: { increment: 1 } }, select: { failedLoginAttempts: true } });
    const lockedUntil = lockedUntilForAttempts(failedLoginAttempts, now);
    if (lockedUntil) {
      await prisma.user.update({ where: { id: user.id }, data: { lockedUntil } });
      console.warn(`[auth] Compte verrouillé après ${failedLoginAttempts} échecs (second facteur) : utilisateur ${user.id}`);
    }
    return NextResponse.json({ error: "invalid_code" }, { status: 401, headers: NO_STORE });
  }

  if (user.failedLoginAttempts > 0 || user.lockedUntil) {
    await prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockedUntil: null } });
  }
  await clearPendingCookie();
  await setSessionCookie(await createSessionToken({ sub: user.id, role: user.role }));
  after(() => recordLoginEvent({
    userId: user.id,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent") ?? "",
    method: "totp",
    success: true,
  }));
  return NextResponse.json({ user: safeUser(user), next: sanitizeNextPath(pending.next), method: result.method }, { headers: NO_STORE });
}
