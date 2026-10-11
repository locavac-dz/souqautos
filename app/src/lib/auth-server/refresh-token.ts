import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const REFRESH_COOKIE = process.env.NODE_ENV === "production" ? "__Host-souq_auto_refresh" : "souq_auto_refresh";
export const REFRESH_DURATION_SECONDS = 60 * 60 * 24 * 30; // 30 jours

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createRefreshSession(
  userId: string,
  meta: { ip?: string; userAgent?: string } = {}
): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await prisma.session.create({
    data: {
      userId,
      refreshTokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + REFRESH_DURATION_SECONDS * 1000),
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
    },
  });
  return token;
}

export type RefreshResult =
  | { ok: true; userId: string; role: string; newToken: string }
  | { ok: false; error: "invalid" | "expired" | "revoked" | "reuse_detected" };

export async function rotateRefreshToken(token: string): Promise<RefreshResult> {
  const hash = hashToken(token);
  const session = await prisma.session.findUnique({ where: { refreshTokenHash: hash } });

  if (!session) {
    // Token inconnu — soit invalide, soit déjà tourné (réutilisation).
    // On ne peut pas distinguer sans conserver l'historique des anciens hashs,
    // mais un token valide un jour qui disparaît est suspect.
    return { ok: false, error: "invalid" };
  }

  if (session.revokedAt) {
    // Token révoqué et réutilisé : compromission probable. Révoquer TOUTES les
    // sessions de cet utilisateur (la famille entière).
    await prisma.session.updateMany({
      where: { userId: session.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: false, error: "reuse_detected" };
  }

  if (session.expiresAt <= new Date()) {
    return { ok: false, error: "expired" };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, role: true, suspendedAt: true, deletedAt: true, sessionsValidAfter: true },
  });

  if (!user || user.suspendedAt || user.deletedAt) {
    return { ok: false, error: "invalid" };
  }

  if (user.sessionsValidAfter && session.createdAt < user.sessionsValidAfter) {
    await prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    return { ok: false, error: "revoked" };
  }

  // Rotation : révoquer l'ancien, créer le nouveau dans une transaction.
  const newToken = randomBytes(32).toString("base64url");
  await prisma.$transaction([
    prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    }),
    prisma.session.create({
      data: {
        userId: session.userId,
        refreshTokenHash: hashToken(newToken),
        expiresAt: session.expiresAt, // conserve l'expiration d'origine
        ip: session.ip,
        userAgent: session.userAgent,
        lastUsedAt: new Date(),
      },
    }),
  ]);

  return { ok: true, userId: user.id, role: user.role, newToken };
}

export async function revokeRefreshSession(refreshToken: string): Promise<void> {
  const hash = hashToken(refreshToken);
  await prisma.session.updateMany({
    where: { refreshTokenHash: hash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllUserSessions(userId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function setRefreshCookie(token: string) {
  const store = await cookies();
  const isProduction = process.env.NODE_ENV === "production";
  store.set(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: REFRESH_DURATION_SECONDS,
  });
}

export async function clearRefreshCookie() {
  const store = await cookies();
  store.delete(REFRESH_COOKIE);
}

export async function getRefreshTokenFromCookies(): Promise<string | null> {
  const store = await cookies();
  return store.get(REFRESH_COOKIE)?.value ?? null;
}
