import { NextRequest, NextResponse } from "next/server";
import { apiHandler, requireUser } from "@/lib/api-route";
import { prisma } from "@/lib/prisma";
import { canAccessConversation } from "@/lib/listing-access";

export const DELETE = apiHandler(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { id } = await params;
  const conversation = await prisma.conversation.findUnique({ where: { id } });
  if (!conversation) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!(await canAccessConversation(user.id, conversation))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Masquage propre à l'utilisateur — jamais une suppression des messages de
  // l'autre partie. Un nouveau message effacera ce masquage (cf. messages/route.ts).
  const isBuyer = conversation.buyerId === user.id;
  await prisma.conversation.update({
    where: { id },
    data: isBuyer ? { hiddenByBuyerAt: new Date() } : { hiddenBySellerAt: new Date() },
  });

  return NextResponse.json({ ok: true });
});
