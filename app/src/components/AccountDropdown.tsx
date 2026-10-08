"use client";

import { useId, useRef, useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { LogoutButton } from "./LogoutButton";

export function AccountDropdown({
  displayName,
  email,
  unreadMessagesCount,
  unreadNotificationsCount,
  unreadGroupsCount,
  staff,
}: {
  displayName: string | null;
  email: string;
  unreadMessagesCount: number;
  unreadNotificationsCount: number;
  unreadGroupsCount: number;
  staff: boolean;
}) {
  const t = useTranslations("Nav");
  const tAdmin = useTranslations("Admin");
  const tMessages = useTranslations("Messages");
  const panelId = useId();
  const pathname = usePathname();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = openedOn === pathname;

  function close() {
    setOpenedOn(null);
  }

  const itemClass =
    "flex items-center gap-2 py-1.5 text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100 whitespace-nowrap";

  return (
    <div
      className="relative"
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          close();
          buttonRef.current?.focus();
        }
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpenedOn(open ? null : pathname)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className="flex items-center gap-1 rounded px-2 py-1 text-sm text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
      >
        <span className="max-w-[8rem] truncate">{displayName ?? email}</span>
        <span aria-hidden="true" className="text-[0.6rem]">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={close}
            aria-hidden="true"
          />
          <div
            id={panelId}
            className="absolute ltr:right-0 rtl:left-0 top-full z-40 mt-1 min-w-[13rem] rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-900"
          >
            <Link href="/compte/mes-annonces" className={itemClass} onClick={close}>{t("myListings")}</Link>
            <Link href="/compte/messages" className={itemClass} onClick={close}>
              {tMessages("navLabel")}
              {unreadMessagesCount > 0 && (
                <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-xs text-white">{unreadMessagesCount}</span>
              )}
            </Link>
            <Link href="/compte/groupes" className={itemClass} onClick={close}>
              {t("groups")}
              {unreadGroupsCount > 0 && (
                <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-xs text-white">{unreadGroupsCount}</span>
              )}
            </Link>
            <Link href="/compte/favoris" className={itemClass} onClick={close}>{t("favorites")}</Link>
            <Link href="/compte/alertes" className={itemClass} onClick={close}>{t("alerts")}</Link>
            <Link href="/compte/notifications" className={itemClass} onClick={close}>
              {t("notifications")}
              {unreadNotificationsCount > 0 && (
                <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-xs text-white">{unreadNotificationsCount}</span>
              )}
            </Link>
            <Link href="/compte/assistant-achat" className={itemClass} onClick={close}>{t("aiAdvisor")}</Link>
            <Link href="/compte/tableau-de-bord" className={itemClass} onClick={close}>{t("dashboard")}</Link>
            {staff && (
              <Link href="/admin" className={itemClass} onClick={close}>{tAdmin("navLabel")}</Link>
            )}
            <div className="my-1.5 border-t border-slate-200 dark:border-slate-700" />
            <LogoutButton label={t("logout")} />
          </div>
        </>
      )}
    </div>
  );
}
