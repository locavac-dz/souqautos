import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler, parseJsonBody } from "@/lib/api-route";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/http";

const DZ_PHONE_RE = /^0[5-7][0-9]{8}$/;

const bodySchema = z.object({
  listingId: z.string().optional(),
  callerName: z.string().trim().min(2).max(100),
  callerPhone: z.string().trim().regex(DZ_PHONE_RE, "Numéro algérien invalide"),
  preferredTime: z.enum(["MATIN", "APRES_MIDI", "SOIR", "PEU_IMPORTE"]).default("PEU_IMPORTE"),
});

export const POST = apiHandler(async (request: NextRequest) => {
  const ip = getClientIp(request);
  if (!(await checkRateLimit(`callback-request:${ip}`, { limit: 5, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await parseJsonBody(request, bodySchema, { issues: "full" });
  if (body instanceof NextResponse) return body;

  const { listingId, callerName, callerPhone, preferredTime } = body;

  // Résoudre le compte pro à partir de l'annonce ou refuser si inconnu
  let proAccountId: string | null = null;
  if (listingId) {
    const listing = await prisma.listing.findUnique({
      where: { id: listingId, status: "PUBLIEE" },
      include: { seller: { include: { professionalAccount: true } } },
    });
    if (!listing || !listing.seller.professionalAccount) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    proAccountId = listing.seller.professionalAccount.id;
  }

  if (!proAccountId) {
    return NextResponse.json({ error: "missing_pro" }, { status: 400 });
  }

  await prisma.callbackRequest.create({
    data: { proAccountId, listingId: listingId ?? null, callerName, callerPhone, preferredTime },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
});
