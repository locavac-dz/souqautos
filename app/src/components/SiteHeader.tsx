import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { LogoutButton } from "./LogoutButton";
import { MobileMenuToggle } from "./MobileMenuToggle";
import { SiteLogoMark } from "./SiteLogoMark";
import { isStaff } from "@/lib/auth-server/roles";
import type { Role } from "@prisma/client";

export async function SiteHeader({
  user,
  unreadMessagesCount = 0,
}: {
  user: { email: string; displayName: string | null; role: Role } | null;
  unreadMessagesCount?: number;
}) {
  const tBrand = await getTranslations("Brand");
  const tNav = await getTranslations("Nav");
  const tAdmin = await getTranslations("Admin");
  const tMessages = await getTranslations("Messages");

  const navContent = (
    <>
      <Link href="/recherche" className="text-slate-700 hover:text-slate-900">
        {tNav("search")}
      </Link>
      <Link href="/cote-souq-auto" className="text-slate-700 hover:text-slate-900">
        {tNav("estimate")}
      </Link>
      {user ? (
        <>
          <Link href="/vendre" className="text-slate-700 hover:text-slate-900">
            {tNav("sell")}
          </Link>
          <Link href="/compte/mes-annonces" className="text-slate-700 hover:text-slate-900">
            {tNav("myListings")}
          </Link>
          <Link
            href="/compte/messages"
            className="relative text-slate-700 hover:text-slate-900"
          >
            {tMessages("navLabel")}
            {unreadMessagesCount > 0 && (
              <span className="ml-1 rounded-full bg-red-600 text-white text-xs px-1.5 py-0.5">
                {unreadMessagesCount}
              </span>
            )}
          </Link>
          <Link href="/compte/favoris" className="text-slate-700 hover:text-slate-900">
            {tNav("favorites")}
          </Link>
          <Link href="/compte/alertes" className="text-slate-700 hover:text-slate-900">
            {tNav("alerts")}
          </Link>
          <Link href="/compte/assistant-achat" className="text-slate-700 hover:text-slate-900">
            {tNav("aiAdvisor")}
          </Link>
          <Link href="/compte/tableau-de-bord" className="text-slate-700 hover:text-slate-900">
            {tNav("dashboard")}
          </Link>
          {isStaff(user.role) && (
            <Link href="/admin" className="text-slate-700 hover:text-slate-900">
              {tAdmin("navLabel")}
            </Link>
          )}
          <span className="text-slate-600">{user.displayName ?? user.email}</span>
          <LogoutButton label={tNav("logout")} />
        </>
      ) : (
        <>
          <Link href="/connexion" className="text-slate-700 hover:text-slate-900">
            {tNav("login")}
          </Link>
          <Link
            href="/inscription"
            className="rounded-md bg-slate-900 px-3 py-1.5 text-white hover:bg-slate-700"
          >
            {tNav("register")}
          </Link>
        </>
      )}
      <LocaleSwitcher />
    </>
  );

  return (
    <header className="border-b border-slate-200">
      <div className="relative mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 font-semibold text-lg tracking-tight text-slate-900">
          <SiteLogoMark className="h-7 w-7 shrink-0" />
          {tBrand("name")}
        </Link>

        <nav className="hidden sm:flex items-center gap-4 text-sm">{navContent}</nav>

        <MobileMenuToggle menuLabel={tNav("menu")}>{navContent}</MobileMenuToggle>
      </div>
    </header>
  );
}
