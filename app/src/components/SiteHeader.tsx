import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AccountDropdown } from "./AccountDropdown";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { LogoutButton } from "./LogoutButton";
import { MobileMenuToggle } from "./MobileMenuToggle";
import { NavLink } from "./NavLink";
import { SiteLogoMark } from "./SiteLogoMark";
import { SiteWordMark } from "./SiteWordMark";
import { ThemeToggle } from "./ThemeToggle";
import { NotificationBell } from "./notifications/NotificationBell";
import { isStaff } from "@/lib/auth-server/roles";
import type { Role } from "@prisma/client";

export async function SiteHeader({
  user,
  unreadMessagesCount = 0,
  unreadNotificationsCount = 0,
  unreadGroupsCount = 0,
}: {
  user: { email: string; displayName: string | null; role: Role } | null;
  unreadMessagesCount?: number;
  unreadNotificationsCount?: number;
  unreadGroupsCount?: number;
}) {
  const tNav = await getTranslations("Nav");
  const tAdmin = await getTranslations("Admin");
  const tMessages = await getTranslations("Messages");

  const navLinkClass = "text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100";

  // Liens publics communs desktop + mobile.
  const publicLinks = (
    <>
      <NavLink href="/recherche" className={navLinkClass}>{tNav("search")}</NavLink>
      <NavLink href="/cote-souq-auto" className={navLinkClass}>{tNav("estimate")}</NavLink>
      <NavLink href="/essais" className={navLinkClass}>{tNav("roadTests")}</NavLink>
      <NavLink href="/assurance" className={navLinkClass}>{tNav("insurance")}</NavLink>
    </>
  );

  // Desktop : liens compte regroupés dans un dropdown ; mobile : liste plate complète.
  const desktopNav = (
    <>
      {publicLinks}
      {user ? (
        <>
          <NavLink href="/vendre" className={navLinkClass}>{tNav("sell")}</NavLink>
          <AccountDropdown
            displayName={user.displayName}
            email={user.email}
            unreadMessagesCount={unreadMessagesCount}
            unreadNotificationsCount={unreadNotificationsCount}
            unreadGroupsCount={unreadGroupsCount}
            staff={isStaff(user.role)}
          />
        </>
      ) : (
        <>
          <NavLink href="/connexion" className={navLinkClass}>{tNav("login")}</NavLink>
          <NavLink
            href="/inscription"
            className="rounded-md bg-slate-900 px-3 py-1.5 text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
          >
            {tNav("register")}
          </NavLink>
        </>
      )}
    </>
  );

  // Mobile : liste plate avec tous les liens visibles.
  const mobileNav = (
    <>
      {publicLinks}
      {user ? (
        <>
          <NavLink href="/vendre" className={navLinkClass}>{tNav("sell")}</NavLink>
          <NavLink href="/compte/mes-annonces" className={navLinkClass}>{tNav("myListings")}</NavLink>
          <NavLink href="/compte/messages" className={`relative ${navLinkClass}`}>
            {tMessages("navLabel")}
            {unreadMessagesCount > 0 && (
              <span className="ms-1 rounded-full bg-red-600 text-white text-xs px-1.5 py-0.5">{unreadMessagesCount}</span>
            )}
          </NavLink>
          <NavLink href="/compte/groupes" className={`relative ${navLinkClass}`}>
            {tNav("groups")}
            {unreadGroupsCount > 0 && (
              <span className="ms-1 rounded-full bg-red-600 text-white text-xs px-1.5 py-0.5">{unreadGroupsCount}</span>
            )}
          </NavLink>
          <NavLink href="/compte/favoris" className={navLinkClass}>{tNav("favorites")}</NavLink>
          <NavLink href="/compte/alertes" className={navLinkClass}>{tNav("alerts")}</NavLink>
          <NavLink href="/compte/notifications" className={`relative ${navLinkClass}`}>
            {tNav("notifications")}
            {unreadNotificationsCount > 0 && (
              <span className="ms-1 rounded-full bg-red-600 text-white text-xs px-1.5 py-0.5">{unreadNotificationsCount}</span>
            )}
          </NavLink>
          <NavLink href="/compte/assistant-achat" className={navLinkClass}>{tNav("aiAdvisor")}</NavLink>
          <NavLink href="/compte/tableau-de-bord" className={navLinkClass}>{tNav("dashboard")}</NavLink>
          {isStaff(user.role) && (
            <NavLink href="/admin" className={navLinkClass}>{tAdmin("navLabel")}</NavLink>
          )}
          <span className="text-slate-600 dark:text-slate-400">{user.displayName ?? user.email}</span>
          <LogoutButton label={tNav("logout")} />
        </>
      ) : (
        <>
          <NavLink href="/connexion" className={navLinkClass}>{tNav("login")}</NavLink>
          <NavLink
            href="/inscription"
            className="rounded-md bg-slate-900 px-3 py-1.5 text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
          >
            {tNav("register")}
          </NavLink>
        </>
      )}
    </>
  );

  return (
    <header className="border-b border-slate-200 dark:border-slate-700 dark:bg-slate-900">
      {/* Serré sous 640 px : en arabe (libellés plus larges), la rangée logo + menu + langue débordait de la fenêtre
          à 375 px (et plus encore à 320 px), d'où un défilement horizontal de toute la page. */}
      <div className="relative mx-auto max-w-6xl px-3 sm:px-4 py-3 flex items-center gap-2 sm:gap-4">
        <Link href="/" className="flex items-center gap-2 sm:gap-3 shrink-0">
          <SiteLogoMark className="h-10 w-10 max-[359px]:h-9 max-[359px]:w-9 sm:h-11 sm:w-11 shrink-0" />
          <SiteWordMark className="text-xl max-[359px]:text-lg sm:text-2xl" />
        </Link>

        {/* Pas d'overflow-hidden ici : même limité à l'axe horizontal (overflow-x-hidden), le CSS force alors
            overflow-y à "auto" au lieu de "visible" (règle du spec sur les deux axes), qui rogne quand même le
            menu de compte qui s'ouvre vers le bas en position absolue. */}
        <nav aria-label={tNav("main")} className="hidden sm:flex items-center gap-4 text-sm flex-1 min-w-0">{desktopNav}</nav>

        <MobileMenuToggle menuLabel={tNav("menu")}>{mobileNav}</MobileMenuToggle>

        <div className="flex items-center gap-1 sm:gap-2 shrink-0 ltr:ml-auto rtl:mr-auto">
          {user && <NotificationBell initialCount={unreadNotificationsCount} />}
          <ThemeToggle />
          <LocaleSwitcher />
        </div>
      </div>
    </header>
  );
}
