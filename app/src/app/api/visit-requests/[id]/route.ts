import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler, parseJsonBody } from "@/lib/api-route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { notifyUser } from "@/lib/notify-user";
import { checkCanCancel, checkCanRespond } from "@/lib/visit-request";

const respondSchema = z.object({
  action: z.enum(["confirm", "decline"]),
  sellerNote: z.string().trim().max(500).optional(),
});

const cancelSchema = z.object({
  action: z.literal("cancel"),
});

const bodySchema = z.union([respondSchema, cancelSchema]);

export const PATCH = apiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    const { id } = await params;

    const visit = await prisma.visitRequest.findUnique({
      where: { id },
      include: {
        listing: { select: { title: true } },
        buyer: { select: { id: true, email: true, profile: { select: { displayName: true } } } },
        seller: { select: { id: true, email: true, profile: { select: { displayName: true } } } },
      },
    });
    if (!visit) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const body = await parseJsonBody(request, bodySchema, { issues: "full" });
    if (body instanceof NextResponse) return body;

    if (body.action === "cancel") {
      if (visit.buyerId !== user.id) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }
      if (!checkCanCancel(visit.status)) {
        return NextResponse.json({ error: "invalid_status" }, { status: 400 });
      }

      await prisma.visitRequest.update({
        where: { id },
        data: { status: "ANNULEE" },
      });

      return NextResponse.json({ ok: true });
    }

    if (visit.sellerId !== user.id) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    if (!checkCanRespond(visit.status)) {
      return NextResponse.json({ error: "invalid_status" }, { status: 400 });
    }

    const newStatus = body.action === "confirm" ? "CONFIRMEE" : "DECLINEE";

    await prisma.visitRequest.update({
      where: { id },
      data: {
        status: newStatus,
        sellerNote: "sellerNote" in body ? (body.sellerNote || null) : null,
      },
    });

    const buyerName = visit.buyer.profile?.displayName ?? visit.buyer.email;
    const sellerName = visit.seller.profile?.displayName ?? visit.seller.email;

    if (newStatus === "CONFIRMEE") {
      await notifyUser({
        userId: visit.buyerId,
        kind: "VISIT_CONFIRMED",
        url: "/compte/visites",
        body: `${sellerName} a confirmé votre visite pour « ${visit.listing.title} »`,
        push: {
          title: "Visite confirmée",
          body: `${sellerName} a confirmé votre visite pour « ${visit.listing.title} »`,
        },
      });
    } else {
      await notifyUser({
        userId: visit.buyerId,
        kind: "VISIT_DECLINED",
        url: "/compte/visites",
        body: `${sellerName} a décliné votre demande de visite pour « ${visit.listing.title} »`,
        push: {
          title: "Visite déclinée",
          body: `${sellerName} a décliné votre demande pour « ${visit.listing.title} »`,
        },
      });
    }

    return NextResponse.json({ ok: true });
  }
);
