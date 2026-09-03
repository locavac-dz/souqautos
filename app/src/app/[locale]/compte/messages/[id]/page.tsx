import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect, Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { ConversationView } from "@/components/messages/ConversationView";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id } = await params;
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: "/connexion", locale });
    return null;
  }

  const t = await getTranslations("Messages");

  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      listing: true,
      buyer: { include: { profile: true } },
      seller: { include: { profile: true } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!conversation || (conversation.buyerId !== user.id && conversation.sellerId !== user.id)) {
    notFound();
  }

  await prisma.message.updateMany({
    where: { conversationId: id, senderId: { not: user.id }, readAt: null },
    data: { readAt: new Date() },
  });

  const otherUser = conversation.buyerId === user.id ? conversation.seller : conversation.buyer;

  const [blockedByMe, blockedByOther] = await Promise.all([
    prisma.block.findUnique({
      where: { blockerId_blockedId: { blockerId: user.id, blockedId: otherUser.id } },
    }),
    prisma.block.findUnique({
      where: { blockerId_blockedId: { blockerId: otherUser.id, blockedId: user.id } },
    }),
  ]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Link href="/compte/messages" className="text-sm text-slate-500 hover:text-slate-700">
        ← {t("backToInbox")}
      </Link>

      <h1 className="text-2xl font-semibold text-slate-900 mt-2">
        {t("withUser", { name: otherUser.profile?.displayName ?? otherUser.email })}
      </h1>
      <Link
        href={`/annonce/${conversation.listingId}`}
        className="text-sm text-slate-500 hover:underline"
      >
        {t("aboutListing", { title: conversation.listing.title })}
      </Link>
      {conversation.buyerId === user.id && (
        <div className="mt-1">
          <Link href={`/vendeur/${otherUser.id}`} className="text-sm text-slate-500 hover:underline">
            {t("leaveReviewLink")}
          </Link>
        </div>
      )}

      <ConversationView
        conversationId={conversation.id}
        initialMessages={conversation.messages}
        currentUserId={user.id}
        otherUserId={otherUser.id}
        initialBlocked={Boolean(blockedByMe)}
        blockedByOther={Boolean(blockedByOther)}
      />
    </div>
  );
}
