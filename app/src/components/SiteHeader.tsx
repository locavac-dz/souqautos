import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { LogoutButton } from "./LogoutButton";
import { MobileMenuToggle } from "./MobileMenuToggle";
import { NavLink } from "./NavLink";
import { SiteLogoMark } from "./SiteLogoMark";
import { SiteWordMark } from "./SiteWordMark";
import { ThemeToggle } from "./ThemeToggle";
import { isStaff } from "@/lib/auth-server/roles";
import type { Role } from "@prisma/client";

export async function SiteHeader({
  user,
  unreadMessagesCount = 0,
}: {
  user: { email: string; displayName: string | null; role: Role } | null;
  unreadMessagesCount?: number;
}) {
  const tNav = await getTranslations("Nav");
  const tAdmin = await getTranslations("Admin");
  const tMessages = await getTranslations("Messages");

  const navLinkClass = "text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100";

  const navContent = (
    <>
      <NavLink href="/recherche" className={navLinkClass}>{tNav("search")}</NavLink>
      <NavLink href="/cote-souq-auto" className={navLinkClass}>{tNav("estimate")}</NavLink>
      <NavLink href="/essais" className={navLinkClass}>{tNav("roadTests")}</NavLink>
      {user ? (
        <>
          <NavLink href="/vendre" className={navLinkClass}>{tNav("sell")}</NavLink>
          <NavLink href="/compte/mes-annonces" className={navLinkClass}>{tNav("myListings")}</NavLink>
          <NavLink href="/compte/messages" className={`relative ${navLinkClass}`}>
            {tMessages("navLabel")}
            {unreadMessagesCount > 0 && (
              <span className="ml-1 rounded-full bg-red-600 text-white text-xs px-1.5 py-0.5">
                {unreadMessagesCount}
              </span>
            )}
          </NavLink>
          <NavLink href="/compte/favoris" className={navLinkClass}>{tNav("favorites")}</NavLink>
          <NavLink href="/compte/alertes" className={navLinkClass}>{tNav("alerts")}</NavLink>
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
      <ThemeToggle />
      <LocaleSwitcher />
    </>
  );

  return (
    <header className="border-b border-slate-200 dark:border-slate-700 dark:bg-slate-900">
      <div className="relative mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2">
          <SiteLogoMark className="h-7 w-7 shrink-0" />
          <SiteWordMark className="text-lg" />
        </Link>

        <nav aria-label={tNav("main")} className="hidden sm:flex items-center gap-4 text-sm">{navContent}</nav>

        <MobileMenuToggle menuLabel={tNav("menu")}>{navContent}</MobileMenuToggle>
      </div>
    </header>
  );
}
