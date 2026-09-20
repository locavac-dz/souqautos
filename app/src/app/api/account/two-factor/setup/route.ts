import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { checkRateLimit } from "@/lib/rate-limit";
import { beginEnrolment } from "@/lib/two-factor";

// Lot 138 — étape 1 de l'activation de la double authentification : tire un secret et le montre (code QR + clé à recopier).
// Réservé à la personne connectée, pour son propre compte. La réponse contient le secret : jamais mise en cache.
const NO_STORE = { "Cache-Control": "no-store" };

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });

  if (!(await checkRateLimit(`2fa-setup:${user.id}`, { limit: 10, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: NO_STORE });
  }

  const result = await beginEnrolment(user.id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.error === "already_enabled" ? 409 : 404, headers: NO_STORE });
  return NextResponse.json({ secret: result.secretDisplay, uri: result.uri, qr: result.qr }, { headers: NO_STORE });
}
