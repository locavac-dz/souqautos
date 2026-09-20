import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { checkRateLimit } from "@/lib/rate-limit";
import { disableTwoFactor } from "@/lib/two-factor";

// Lot 138 — désactiver la double authentification : exige le mot de passe ET un code (une session volée ne suffit pas).
const NO_STORE = { "Cache-Control": "no-store" };
const schema = z.object({ password: z.string().max(200).optional(), code: z.string().trim().min(1).max(40) });

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });

  if (!(await checkRateLimit(`2fa-disable:${user.id}`, { limit: 5, windowMs: 15 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: NO_STORE });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "validation" }, { status: 400, headers: NO_STORE });

  const result = await disableTwoFactor(user.id, parsed.data);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.error === "not_enabled" ? 409 : 400, headers: NO_STORE });
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
