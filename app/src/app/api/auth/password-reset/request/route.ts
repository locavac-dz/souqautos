import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/http";
import { emailSchema } from "@/lib/validation/auth";
import { requestPasswordReset } from "@/lib/password-reset-service";

// Lot 133 — demande de lien « mot de passe oublié ».
//
// RÉPOND TOUJOURS LA MÊME CHOSE (200), que le compte existe ou non : ni le message, ni le code, ni le délai ne
// renseignent sur l'existence d'une adresse. La recherche du compte et l'envoi du courriel se font APRÈS la réponse
// (`after`), pour que la réponse ne dépende pas du temps d'envoi.
//
// Limites : par adresse IP, et par adresse e-mail (que le compte existe ou non — la limite ne doit pas non plus trahir
// l'existence), pour qu'on ne puisse pas inonder une boîte mail de messages.
const bodySchema = z.object({ email: emailSchema });

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  if (!(await checkRateLimit(`password-reset-ip:${ip}`, { limit: 5, windowMs: 15 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "validation" }, { status: 400 });
  }
  const { email } = parsed.data;

  if (!(await checkRateLimit(`password-reset-email:${email}`, { limit: 3, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  after(async () => {
    try {
      await requestPasswordReset(email);
    } catch (error) {
      // Jamais de détail vers le visiteur : l'échec (SMTP, base) reste dans les journaux du serveur.
      console.error(`[auth] Réinitialisation de mot de passe : envoi impossible — ${(error as Error).message}`);
    }
  });

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
