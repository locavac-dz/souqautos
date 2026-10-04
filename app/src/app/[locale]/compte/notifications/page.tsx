import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect, Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { getNotifications } from "@/lib/notification-service";
import { MarkAllReadButton } from "@/components/notifications/MarkAllReadButton";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

function relativeTime(date: Date, locale: string): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffH = Math.floor(diffMs / 3_600_000);
  const diffD = Math.floor(diffMs / 86_400_000);
  const isAr = locale === "ar";

  if (diffMin < 1) return isAr ? "الآن" : "à l'instant";
  if (diffMin < 60) return isAr ? `منذ ${diffMin} د` : `il y a ${diffMin} min`;
  if (diffH < 24) return isAr ? `منذ ${diffH} س` : `il y a ${diffH} h`;
  if (diffD < 30) return isAr ? `منذ ${diffD} يوم` : `il y a ${diffD} j`;
  return date.toLocaleDateString(isAr ? "ar-DZ" : "fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

export default async function NotificationsPage() {
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: "/connexion", locale });
    return null;
  }

  const t = await getTranslations("InAppNotifications");
  const notifications = await getNotifications(user.id, 50);
  const unread = notifications.filter((n) => !n.readAt).length;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="flex items-center justify-between mb-6 gap-4">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{t("title")}</h1>
        {unread > 0 && <MarkAllReadButton label={t("markAllRead")} />}
      </div>

      {notifications.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">{t("empty")}</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {notifications.map((n) => (
            <li key={n.id} className={`py-4 ${!n.readAt ? "bg-blue-50/50 dark:bg-blue-900/10 -mx-2 px-2 rounded-md" : ""}`}>
              <Link href={n.data.url as `/${string}`} className="block hover:opacity-80">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {n.data.title ?? t(`kind.${n.kind}`)}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">{n.data.body}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  {relativeTime(n.createdAt, locale)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
