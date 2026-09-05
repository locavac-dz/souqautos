import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect, Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { getManageableSellerIds } from "@/lib/listing-access";
import { DeleteConversationButton } from "@/components/messages/DeleteConversationButton";

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

  const unreadCounts = await Promise.all(
    conversations.map((c) =>
      prisma.message.count({
        where: { conversationId: c.id, senderId: { not: user.id }, readAt: null },
      })
    )
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">{t("inboxTitle")}</h1>

      {conversations.length === 0 ? (
        <p className="text-slate-500 text-center py-12">{t("inboxEmpty")}</p>
      ) : (
        <div className="space-y-2">
          {conversations.map((conversation, i) => {
            const otherUser = conversation.buyerId === user.id ? conversation.seller : conversation.buyer;
            const lastMessage = conversation.messages[0];
            const unread = unreadCounts[i];
            return (
              <div
                key={conversation.id}
                className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 hover:border-slate-300"
              >
                <Link href={`/compte/messages/${conversation.id}`} className="flex flex-1 min-w-0 gap-3">
                  {conversation.listing.photos[0] ? (
                    <div className="relative h-16 w-20 shrink-0">
                      <Image
                        src={conversation.listing.photos[0].path}
                        alt=""
                        fill
                        sizes="80px"
                        className="rounded object-cover border border-slate-100"
                      />
                    </div>
                  ) : (
                    <div className="h-16 w-20 rounded bg-slate-100 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-slate-900 truncate">
                        {otherUser.profile?.displayName ?? otherUser.email}
                      </p>
                      {unread > 0 && (
                        <span className="rounded-full bg-slate-900 text-white text-xs px-2 py-0.5 shrink-0">
                          {unread}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 truncate">{conversation.listing.title}</p>
                    {lastMessage && (
                      <p
                        className={`text-sm text-slate-500 truncate mt-0.5 ${lastMessage.deletedAt ? "italic" : ""}`}
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
