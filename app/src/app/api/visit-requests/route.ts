import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler, parseJsonBody } from "@/lib/api-route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/http";
import { notifyUser } from "@/lib/notify-user";
import { checkCanRequestVisit, checkProposedDate } from "@/lib/visit-request";

const bodySchema = z.object({
  listingId: z.string().min(1),
  proposedAt: z.string().datetime(),
  message: z.string().trim().max(500).optional(),
});

export const POST = apiHandler(async (request: NextRequest) => {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const ip = getClientIp(request);
  if (!(await checkRateLimit(`visit-request:${ip}`, { limit: 10, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await parseJsonBody(request, bodySchema, { issues: "full" });
  if (body instanceof NextResponse) return body;

  const proposedAt = new Date(body.proposedAt);
  const dateError = checkProposedDate(proposedAt);
  if (dateError) {
    return NextResponse.json({ error: dateError }, { status: 400 });
  }

  const listing = await prisma.listing.findUnique({
    where: { id: body.listingId },
    select: { id: true, title: true, status: true, sellerId: true },
  });
  if (!listing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const [pendingForListing, totalPending] = await Promise.all([
    prisma.visitRequest.count({
      where: { buyerId: user.id, listingId: listing.id, status: "EN_ATTENTE" },
    }),
    prisma.visitRequest.count({
      where: { buyerId: user.id, status: "EN_ATTENTE" },
    }),
  ]);

  const error = checkCanRequestVisit(
    user.id,
    listing.sellerId,
    listing.status,
    pendingForListing,
    totalPending
  );
  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  const visit = await prisma.visitRequest.create({
    data: {
      listingId: listing.id,
      buyerId: user.id,
      sellerId: listing.sellerId,
      proposedAt,
      message: body.message || null,
    },
  });

  await notifyUser({
    userId: listing.sellerId,
    kind: "VISIT_REQUESTED",
    url: "/compte/visites",
    body: `${user.profile?.displayName ?? user.email} souhaite visiter « ${listing.title} »`,
    push: {
      title: "Nouvelle demande de visite",
      body: `${user.profile?.displayName ?? user.email} souhaite visiter « ${listing.title} »`,
    },
  });

  return NextResponse.json({ id: visit.id }, { status: 201 });
});
