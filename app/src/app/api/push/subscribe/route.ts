import { NextRequest, NextResponse } from "next/server";
import { apiHandler, requireUser, parseJsonBody, NO_STORE } from "@/lib/api-route";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { isUniqueViolation } from "@/lib/prisma-errors";
import { MAX_ENDPOINT_LENGTH, MAX_SUBSCRIPTIONS_PER_USER, pushSubscriptionSchema, resolvePushConfig } from "@/lib/push";

// Lot 121 — abonner (POST) ou désabonner (DELETE) l'appareil courant aux notifications.
export const POST = apiHandler(async (request: NextRequest) => {
  const user = await requireUser({ headers: NO_STORE });
  if (user instanceof NextResponse) return user;

  if (!(await checkRateLimit(`push-subscribe:${user.id}`, { limit: 20, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: NO_STORE });
  }

  if (resolvePushConfig(process.env).mode !== "enabled") {
    return NextResponse.json({ error: "push_disabled" }, { status: 503, headers: NO_STORE });
  }

  const body = await parseJsonBody(request, pushSubscriptionSchema, { headers: NO_STORE });
  if (body instanceof NextResponse) return body;
  const { endpoint, keys } = body;
  const userAgent = request.headers.get("user-agent")?.slice(0, 300) ?? null;

  // Un appareil = une ligne (adresse unique). Si un autre compte s'est servi de cet appareil, la
  // ligne change de propriétaire : l'ancien compte ne reçoit plus rien dessus.
  try {
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: { userId: user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent },
      update: { userId: user.id, p256dh: keys.p256dh, auth: keys.auth, userAgent },
    });
  } catch (error) {
    // Deux abonnements simultanés du même appareil : l'un est déjà enregistré, c'est le résultat voulu.
    if (!isUniqueViolation(error)) throw error;
  }

  // Au plus MAX_SUBSCRIPTIONS_PER_USER appareils par compte : les plus anciens sont oubliés.
  const devices = await prisma.pushSubscription.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (devices.length > MAX_SUBSCRIPTIONS_PER_USER) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: devices.slice(MAX_SUBSCRIPTIONS_PER_USER).map((d) => d.id) } } });
  }

  return NextResponse.json({ ok: true }, { status: 201, headers: NO_STORE });
});

const unsubscribeSchema = z.object({ endpoint: z.string().min(1).max(MAX_ENDPOINT_LENGTH) });

export const DELETE = apiHandler(async (request: NextRequest) => {
  const user = await requireUser({ headers: NO_STORE });
  if (user instanceof NextResponse) return user;

  const body = await parseJsonBody(request, unsubscribeSchema, { headers: NO_STORE });
  if (body instanceof NextResponse) return body;

  // Seulement SES appareils : on ne peut pas désabonner celui d'un autre compte.
  const removed = await prisma.pushSubscription.deleteMany({ where: { endpoint: body.endpoint, userId: user.id } });
  return NextResponse.json({ ok: true, removed: removed.count }, { headers: NO_STORE });
});
