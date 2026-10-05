import { getLocale, getTranslations } from "next-intl/server";
import { redirect, Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { GroupConversationView } from "@/components/groups/GroupConversationView";

export default async function GroupConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: "/connexion", locale });
    return null;
  }

  const t = await getTranslations("Groups");
  const { id } = await params;

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: id, userId: user.id } },
  });
  if (!membership) notFound();

  const [group, messages] = await Promise.all([
    prisma.groupConversation.findUnique({
      where: { id },
      include: {
        members: {
          include: { user: { include: { profile: true } } },
          orderBy: { joinedAt: "asc" },
        },
      },
    }),
    prisma.groupMessage.findMany({
      where: { groupId: id },
      orderBy: { createdAt: "asc" },
      take: 50,
      include: { sender: { include: { profile: true } } },
    }),
  ]);

  if (!group) notFound();

  // Marquer comme lu
  await prisma.groupMember.update({
    where: { groupId_userId: { groupId: id, userId: user.id } },
    data: { lastReadAt: new Date() },
  });

  const groupDetail = {
    id: group.id,
    name: group.name,
    createdById: group.createdById,
    isAdmin: membership.isAdmin,
    members: group.members.map((m) => ({
      userId: m.userId,
      userName: m.user.profile?.displayName ?? m.user.email,
      isAdmin: m.isAdmin,
    })),
  };

  const initialMessages = messages.map((m) => ({
    id: m.id,
    senderId: m.senderId,
    senderName: m.sender.profile?.displayName ?? m.sender.email,
    content: m.content,
    attachmentUrl: m.attachmentUrl,
    audioUrl: m.audioUrl,
    deletedAt: m.deletedAt,
    createdAt: m.createdAt.toISOString(),
  }));

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 h-[calc(100vh-4rem)] flex flex-col">
      <Link href="/compte/groupes" className="text-sm text-slate-500 hover:underline dark:text-slate-400 mb-4 block shrink-0">
        ← {t("back")}
      </Link>

      <div className="flex-1 flex flex-col min-h-0">
        <GroupConversationView
          group={groupDetail}
          initialMessages={initialMessages}
          currentUserId={user.id}
        />
      </div>
    </div>
  );
}
