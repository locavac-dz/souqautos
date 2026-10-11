import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-route";
import { clearSessionCookie, getSessionFromCookies } from "@/lib/auth-server/session";
import { revokeSession } from "@/lib/auth-server/session-revocation";
import { getRefreshTokenFromCookies, revokeRefreshSession, clearRefreshCookie } from "@/lib/auth-server/refresh-token";

export const POST = apiHandler(async () => {
  const session = await getSessionFromCookies();
  if (session?.jti) await revokeSession(session.jti, session.expiresAtMs);
  await clearSessionCookie();

  const refreshToken = await getRefreshTokenFromCookies();
  if (refreshToken) await revokeRefreshSession(refreshToken);
  await clearRefreshCookie();

  return NextResponse.json({ ok: true });
});
