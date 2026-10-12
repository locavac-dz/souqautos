import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/http";
import { logError } from "@/lib/error-log";
import { apiHandler } from "@/lib/api-route";

// Lot 293 — reçoit les erreurs du NAVIGATEUR (error boundaries, erreurs non rattrapées).
//
// Limité par adresse IP (10/min) : un script ou un onglet en boucle ne remplit pas la table.
// Répond toujours 204 : le navigateur n'en fait rien, et un visiteur malveillant n'apprend rien.
export const POST = apiHandler(async (request: NextRequest) => {
  const ip = getClientIp(request);
  if (!(await checkRateLimit(`client-error:${ip}`, { limit: 10, windowMs: 60_000 }))) {
    return new NextResponse(null, { status: 204 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return new NextResponse(null, { status: 204 });

  const message = typeof body.message === "string" ? body.message.slice(0, 500) : "";
  const stack = typeof body.stack === "string" ? body.stack.slice(0, 4000) : null;
  const digest = typeof body.digest === "string" ? body.digest.slice(0, 40) : null;

  if (!message) return new NextResponse(null, { status: 204 });

  await logError({
    kind: "client",
    message: digest ? `${message} [${digest}]` : message,
    stack,
    route: typeof body.route === "string" ? body.route.slice(0, 200) : null,
    context: "client",
    userAgent: (request.headers.get("user-agent") ?? "").slice(0, 300),
  });

  return new NextResponse(null, { status: 204 });
});
