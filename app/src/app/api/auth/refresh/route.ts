import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-route";
import { createSessionToken, setSessionCookie } from "@/lib/auth-server/session";
import {
  getRefreshTokenFromCookies,
  rotateRefreshToken,
  setRefreshCookie,
  clearRefreshCookie,
} from "@/lib/auth-server/refresh-token";

export const POST = apiHandler(async () => {
  const refreshToken = await getRefreshTokenFromCookies();
  if (!refreshToken) {
    return NextResponse.json({ error: "no_refresh_token" }, { status: 401 });
  }

  const result = await rotateRefreshToken(refreshToken);
  if (!result.ok) {
    await clearRefreshCookie();
    return NextResponse.json({ error: result.error }, { status: 401 });
  }

  const accessToken = await createSessionToken({ sub: result.userId, role: result.role });
  await setSessionCookie(accessToken);
  await setRefreshCookie(result.newToken);

  return NextResponse.json({ ok: true });
});
