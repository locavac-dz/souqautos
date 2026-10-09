import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "@/lib/api-route";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/http";
import { newPasswordSchema } from "@/lib/validation/auth";
import { confirmPasswordReset } from "@/lib/password-reset-service";

// Lot 133 — choix du nouveau mot de passe avec le lien reçu par courriel.
// Ne crée PAS de session : la personne se reconnecte avec son nouveau mot de passe (et toutes les sessions ouvertes
// avant ce changement sont révoquées par confirmPasswordReset).
const bodySchema = z.object({ token: z.string().min(1).max(200), password: newPasswordSchema });

export async function POST(request: NextRequest) {
  if (!(await checkRateLimit(`password-reset-confirm:${getClientIp(request)}`, { limit: 10, windowMs: 15 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await parseJsonBody(request, bodySchema);
  if (body instanceof NextResponse) return body;

  const result = await confirmPasswordReset(body.token, body.password);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
