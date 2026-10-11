import { NextRequest, NextResponse } from "next/server";
import { apiHandler, requireUser, parseJsonBody, NO_STORE } from "@/lib/api-route";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rate-limit";
import { disableTwoFactor } from "@/lib/two-factor";

// Lot 138 — désactiver la double authentification : exige le mot de passe ET un code (une session volée ne suffit pas).
const schema = z.object({ password: z.string().max(200).optional(), code: z.string().trim().min(1).max(40) });

export const POST = apiHandler(async (request: NextRequest) => {
  const user = await requireUser({ headers: NO_STORE });
  if (user instanceof NextResponse) return user;

  if (!(await checkRateLimit(`2fa-disable:${user.id}`, { limit: 5, windowMs: 15 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: NO_STORE });
  }
  const body = await parseJsonBody(request, schema, { headers: NO_STORE });
  if (body instanceof NextResponse) return body;

  const result = await disableTwoFactor(user.id, body);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.error === "not_enabled" ? 409 : 400, headers: NO_STORE });
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
});
