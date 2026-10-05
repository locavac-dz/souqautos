import { getLocale, getTranslations } from "next-intl/server";
import { redirect, Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";

export default async function GroupsPage() {
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: "/connexion", locale });
    return null;
  }

  const t = await getTranslations("Groups");

  const memberships = await prisma.groupMember.findMany({
    where: { userId: user.id },
    include: {
      group: {
        include: {
          messages: { orderBy: { createdAt: "desc" }, take: 1 },
          _count: { select: { members: true } },
        },
      },
    },
    orderBy: { group: { updatedAt: "desc" } },
  });

  const groups = memberships.map(({ group, lastReadAt }) => ({
    id: group.id,
    name: group.name,
    memberCount: group._count.members,
    lastMessage: group.messages[0] ?? null,
    hasUnread: group.messages[0]
      ? !lastReadAt || group.messages[0].createdAt > lastReadAt
      : false,
  }));

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{t("pageTitle")}</h1>
        <Link
          href="/compte/groupes/nouveau"
          className="rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
        >
          {t("newGroup")}
        </Link>
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">{t("pageEmpty")}</p>
      ) : (
        <ul className="divide-y divide-slate-200 dark:divide-slate-700">
          {groups.map((g) => (
            <li key={g.id}>
              <Link
                href={`/compte/groupes/${g.id}`}
                className="flex items-center gap-3 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 -mx-2 px-2 rounded-md transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900 dark:text-slate-100 truncate">{g.name}</span>
                    {g.hasUnread && (
                      <span className="shrink-0 w-2 h-2 rounded-full bg-teal-500" title={t("unread")} />
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {t("memberCount", { count: g.memberCount })}
                    {g.lastMessage && (
                      <>
                        {" · "}
                        <span className="truncate">{g.lastMessage.content || "…"}</span>
                      </>
                    )}
                  </p>
                </div>
                <span className="text-slate-400 dark:text-slate-500 shrink-0">›</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
