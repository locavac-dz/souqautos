"use client";

import { Link, usePathname } from "@/i18n/navigation";

type Props = {
  href: string;
  className: string;
  children: React.ReactNode;
};

export function NavLink({ href, className, children }: Props) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link href={href} className={className} aria-current={isActive ? "page" : undefined}>
      {children}
    </Link>
  );
}
