import { NextResponse } from "next/server";
import { clearSessionCookie, getSessionFromCookies } from "@/lib/auth-server/session";
import { revokeSession } from "@/lib/auth-server/session-revocation";

export async function POST() {
  // Lot 229 — le jeton lui-même est révoqué côté serveur : effacer le cookie ne suffisait pas, une copie restait valable sept jours.
  const session = await getSessionFromCookies();
  if (session?.jti) await revokeSession(session.jti, session.expiresAtMs);
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
