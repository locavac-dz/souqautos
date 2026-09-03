import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { id } = await params;
  const conversation = await prisma.conversation.findUnique({ where: { id } });
  if (!conversation) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (conversation.buyerId !== user.id && conversation.sellerId !== user.id) {
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
}
