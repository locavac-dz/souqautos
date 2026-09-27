import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { checkRateLimit } from "@/lib/rate-limit";
import { beginEnrolment } from "@/lib/two-factor";

// Lot 138 — étape 1 de l'activation de la double authentification : tire un secret et le montre (code QR + clé à recopier).
// Réservé à la personne connectée, pour son propre compte, sur présentation de son mot de passe (Lot 229). La réponse contient
// le secret : jamais mise en cache.
const NO_STORE = { "Cache-Control": "no-store" };
const schema = z.object({ password: z.string().max(200).optional() });
const STATUS: Record<"already_enabled" | "not_found" | "invalid_password", number> = { already_enabled: 409, not_found: 404, invalid_password: 400 };

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });

  if (!(await checkRateLimit(`2fa-setup:${user.id}`, { limit: 10, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: NO_STORE });
  }
  const parsed = schema.safeParse((await request.json().catch(() => null)) ?? {});
  if (!parsed.success) return NextResponse.json({ error: "validation" }, { status: 400, headers: NO_STORE });

  const result = await beginEnrolment(user.id, parsed.data.password);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: STATUS[result.error], headers: NO_STORE });
  return NextResponse.json({ secret: result.secretDisplay, uri: result.uri, qr: result.qr }, { headers: NO_STORE });
}
