import { NextRequest, NextResponse } from "next/server";
import { apiHandler, requireUser, parseJsonBody } from "@/lib/api-route";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkCanMessage } from "@/lib/messaging";
import { checkRateLimit } from "@/lib/rate-limit";
import { isUniqueViolation } from "@/lib/prisma-errors";

const bodySchema = z.object({
  listingId: z.string().min(1),
  initialMessage: z.string().trim().max(500).optional(),
});

export const POST = apiHandler(async (request: NextRequest) => {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  if (!(await checkRateLimit(`start-conversation:${user.id}`, { limit: 20, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await parseJsonBody(request, bodySchema);
  if (body instanceof NextResponse) return body;

  const listing = await prisma.listing.findUnique({ where: { id: body.listingId } });
  if (!listing || listing.status !== "PUBLIEE") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const [blockedByOther, blockedOther] = await Promise.all([
    prisma.block.findUnique({
      where: { blockerId_blockedId: { blockerId: listing.sellerId, blockedId: user.id } },
    }),
    prisma.block.findUnique({
      where: { blockerId_blockedId: { blockerId: user.id, blockedId: listing.sellerId } },
    }),
  ]);

  const check = checkCanMessage({
    isSelf: user.id === listing.sellerId,
    isBlocked: Boolean(blockedByOther || blockedOther),
  });
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: 400 });
  }

  const conversationKey = { listingId_buyerId: { listingId: listing.id, buyerId: user.id } };
  let conversation: { id: string } | null;
  try {
    conversation = await prisma.conversation.upsert({
      where: conversationKey,
      update: {},
      create: { listingId: listing.id, buyerId: user.id, sellerId: listing.sellerId },
      select: { id: true },
    });
  } catch (error) {
    // Deux requêtes simultanées : l'autre a déjà ouvert la conversation, on la
    // renvoie (`upsert` sur une clé composée n'est pas atomique côté base).
    if (!isUniqueViolation(error)) throw error;
    conversation = await prisma.conversation.findUnique({ where: conversationKey, select: { id: true } });
    if (!conversation) throw error;
  }

  const { initialMessage } = body;
  if (initialMessage && initialMessage.length > 0) {
    const existingCount = await prisma.message.count({ where: { conversationId: conversation.id } });
    if (existingCount === 0) {
      await prisma.message.create({
        data: { conversationId: conversation.id, senderId: user.id, content: initialMessage },
      });
    }
  }

  return NextResponse.json({ conversation }, { status: 201 });
});
