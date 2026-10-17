// Lecture de la session côté serveur dans l'App Router (next/headers).
import { cookies } from "next/headers";
import { getServices } from "@/lib/services";
import { verifySession } from "@/lib/auth/session";
import { sessionRevoquee } from "@/lib/auth/revocation";
import { sessionCookieName } from "@/lib/auth/cookies";
import type { VerifiedSession } from "@/lib/tenant/context";

export async function getServerSession(): Promise<VerifiedSession | null> {
  const s = getServices();
  const store = await cookies();
  const token = store.get(sessionCookieName(s.secure))?.value;
  if (!token) return null;
  const session = await verifySession(token, s.secret);
  if (!session) return null;
  // Session révoquée (epoch obsolète, compte désactivé) → traitée comme absente.
  if (await sessionRevoquee(session, s.admin)) return null;
  return session;
}
