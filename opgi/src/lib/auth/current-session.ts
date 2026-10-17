// Pont entre le cookie de session et la session vérifiée utilisée par la couche
// d'isolation. Lit le cookie, vérifie la signature, renvoie la session ou null.
import type { VerifiedSession } from "@/lib/tenant/context";
import { readCookie, sessionCookieName } from "@/lib/auth/cookies";
import { verifySession } from "@/lib/auth/session";

export async function sessionFromCookieHeader(
  cookieHeader: string | null | undefined,
  secret: string,
  secure: boolean,
): Promise<VerifiedSession | null> {
  const token = readCookie(cookieHeader, sessionCookieName(secure));
  if (!token) return null;
  return verifySession(token, secret);
}
