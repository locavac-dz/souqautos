// Lecture de la session côté serveur dans l'App Router (next/headers).
import { cookies } from "next/headers";
import { getServices } from "@/lib/services";
import { verifySession } from "@/lib/auth/session";
import { sessionCookieName } from "@/lib/auth/cookies";
import type { VerifiedSession } from "@/lib/tenant/context";

export async function getServerSession(): Promise<VerifiedSession | null> {
  const s = getServices();
  const store = await cookies();
  const token = store.get(sessionCookieName(s.secure))?.value;
  if (!token) return null;
  return verifySession(token, s.secret);
}
