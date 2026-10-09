import { NextRequest, NextResponse } from "next/server";
import { requireUser, parseJsonBody, NO_STORE } from "@/lib/api-route";
import { z } from "zod";
import { createSessionToken, setSessionCookie } from "@/lib/auth-server/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { confirmEnrolment } from "@/lib/two-factor";

// Lot 138 — étape 2 : la personne saisit le code que lit son application. Renvoie les dix codes de secours, UNE SEULE FOIS.
const schema = z.object({ code: z.string().trim().min(1).max(40) });

export async function POST(request: NextRequest) {
  const user = await requireUser({ headers: NO_STORE });
  if (user instanceof NextResponse) return user;

  if (!(await checkRateLimit(`2fa-enable:${user.id}`, { limit: 10, windowMs: 15 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: NO_STORE });
  }
  const body = await parseJsonBody(request, schema, { headers: NO_STORE });
  if (body instanceof NextResponse) return body;

  const result = await confirmEnrolment(user.id, body.code);
  if (!result.ok) {
    const status = result.error === "invalid_code" ? 400 : result.error === "not_found" ? 404 : 409;
    return NextResponse.json({ error: result.error }, { status, headers: NO_STORE });
  }

  // L'activation révoque toutes les sessions ouvertes avant cet instant (dont celle de cette requête) : on en émet une nouvelle,
  // sinon la personne serait déconnectée à la seconde même où elle protège son compte.
  await setSessionCookie(await createSessionToken({ sub: user.id, role: user.role }));
  return NextResponse.json({ recoveryCodes: result.recoveryCodes }, { headers: NO_STORE });
}
