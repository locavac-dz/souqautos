import type { Metadata } from "next";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect, Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { getManageableSellerIds } from "@/lib/listing-access";
import { DeleteConversationButton } from "@/components/messages/DeleteConversationButton";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function InboxPage() {
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: "/connexion", locale });
    return null;
  }

  const t = await getTranslations("Messages");

  // Inclut les conversations des comptes professionnels que cet utilisateur
  // gère en tant que collaborateur (permission gererAnnonces), pas seulement
  // les siennes propres — même principe que /compte/mes-annonces (Lot 43).
  const manageableSellerIds = await getManageableSellerIds(user.id);

  const conversations = await prisma.conversation.findMany({
    where: {
      OR: [
        { buyerId: user.id, hiddenByBuyerAt: null },
        { sellerId: { in: manageableSellerIds }, hiddenBySellerAt: null },
      ],
    },
    orderBy: { createdAt: "desc" },
    include: {
      listing: { include: { photos: { orderBy: { position: "asc" }, take: 1 } } },
      buyer: { include: { profile: true } },
      seller: { include: { profile: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  // Lot 219 — un seul groupBy pour tous les compteurs au lieu d'un COUNT par conversation (N+1).
  const unreadGroups = await prisma.message.groupBy({
    by: ["conversationId"],
    where: {
      conversationId: { in: conversations.map((c) => c.id) },
      senderId: { not: user.id },
      readAt: null,
    },
    _count: { id: true },
  });
  const unreadByConversation = new Map(unreadGroups.map((g) => [g.conversationId, g._count.id]));

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-6">{t("inboxTitle")}</h1>

      {conversations.length === 0 ? (
        <p className="text-slate-500 dark:text-slate-400 text-center py-12">{t("inboxEmpty")}</p>
      ) : (
        <div className="space-y-2">
          {conversations.map((conversation) => {
            const otherUser = conversation.buyerId === user.id ? conversation.seller : conversation.buyer;
            const lastMessage = conversation.messages[0];
            const unread = unreadByConversation.get(conversation.id) ?? 0;
            return (
              <div
                key={conversation.id}
                className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 p-3 hover:border-slate-300 dark:hover:border-slate-500"
              >
                <Link href={`/compte/messages/${conversation.id}`} className="flex flex-1 min-w-0 gap-3">
                  {conversation.listing.photos[0] ? (
                    <div className="relative h-16 w-20 shrink-0">
                      <Image
                        src={conversation.listing.photos[0].path}
                        alt=""
                        fill
                        sizes="80px"
                        className="rounded object-cover border border-slate-100 dark:border-slate-700"
                      />
                    </div>
                  ) : (
                    <div className="h-16 w-20 rounded bg-slate-100 dark:bg-slate-700 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-slate-900 dark:text-slate-100 truncate">
                        {otherUser.profile?.displayName ?? otherUser.email}
                      </p>
                      {unread > 0 && (
                        <span className="rounded-full bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white text-xs px-2 py-0.5 shrink-0">
                          {unread}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{conversation.listing.title}</p>
                    {lastMessage && (
                      <p
                        className={`text-sm text-slate-500 dark:text-slate-400 truncate mt-0.5 ${lastMessage.deletedAt ? "italic" : ""}`}
                      >
                        {lastMessage.deletedAt
                          ? t("messageDeleted")
                          : lastMessage.content || (lastMessage.attachmentUrl ? t("attachmentPreview") : "")}
                      </p>
                    )}
                  </div>
                </Link>
                <DeleteConversationButton conversationId={conversation.id} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
