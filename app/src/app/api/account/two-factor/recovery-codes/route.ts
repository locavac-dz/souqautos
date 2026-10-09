import { NextRequest, NextResponse } from "next/server";
import { requireUser, parseJsonBody, NO_STORE } from "@/lib/api-route";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rate-limit";
import { regenerateRecoveryCodes } from "@/lib/two-factor";

// Lot 138 — de nouveaux codes de secours (les anciens cessent de fonctionner), sur présentation d'un code. Montrés une seule fois.
const schema = z.object({ code: z.string().trim().min(1).max(40) });

export async function POST(request: NextRequest) {
  const user = await requireUser({ headers: NO_STORE });
  if (user instanceof NextResponse) return user;

  if (!(await checkRateLimit(`2fa-recovery:${user.id}`, { limit: 5, windowMs: 15 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: NO_STORE });
  }
  const body = await parseJsonBody(request, schema, { headers: NO_STORE });
  if (body instanceof NextResponse) return body;

  const result = await regenerateRecoveryCodes(user.id, body.code);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.error === "not_enabled" ? 409 : 400, headers: NO_STORE });
  return NextResponse.json({ recoveryCodes: result.recoveryCodes }, { headers: NO_STORE });
}
