import { NextResponse } from "next/server";
import { apiHandler, requireUser } from "@/lib/api-route";
import { prisma } from "@/lib/prisma";
import { canAccessConversation } from "@/lib/listing-access";

export const POST = apiHandler(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { id } = await params;
  const conversation = await prisma.conversation.findUnique({ where: { id } });
  if (!conversation || !(await canAccessConversation(user.id, conversation))) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await prisma.message.updateMany({
    where: { conversationId: id, senderId: { not: user.id }, readAt: null },
    data: { readAt: new Date() },
  });

  return NextResponse.json({ ok: true });
});
