import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { createSessionToken, setSessionCookie } from "@/lib/auth-server/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { confirmEnrolment } from "@/lib/two-factor";

// Lot 138 — étape 2 : la personne saisit le code que lit son application. Renvoie les dix codes de secours, UNE SEULE FOIS.
const NO_STORE = { "Cache-Control": "no-store" };
const schema = z.object({ code: z.string().trim().min(1).max(40) });

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });

  if (!(await checkRateLimit(`2fa-enable:${user.id}`, { limit: 10, windowMs: 15 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: NO_STORE });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "validation" }, { status: 400, headers: NO_STORE });

  const result = await confirmEnrolment(user.id, parsed.data.code);
  if (!result.ok) {
    const status = result.error === "invalid_code" ? 400 : result.error === "not_found" ? 404 : 409;
    return NextResponse.json({ error: result.error }, { status, headers: NO_STORE });
  }

  // L'activation révoque toutes les sessions ouvertes avant cet instant (dont celle de cette requête) : on en émet une nouvelle,
  // sinon la personne serait déconnectée à la seconde même où elle protège son compte.
  await setSessionCookie(await createSessionToken({ sub: user.id, role: user.role }));
  return NextResponse.json({ recoveryCodes: result.recoveryCodes }, { headers: NO_STORE });
}
