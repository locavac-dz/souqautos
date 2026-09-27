import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export function Breadcrumbs({ items }: { items: { name: string; href?: string; lang?: string }[] }) {
  const t = useTranslations("Nav");
  return (
    <nav aria-label={t("breadcrumb")} className="mb-4 text-sm text-slate-500 dark:text-slate-400">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, index) => (
          <li key={index} className="flex items-center gap-1">
            {index > 0 && (
              <span aria-hidden="true" className="text-slate-500 dark:text-slate-400">
                /
              </span>
            )}
            {item.href ? (
              <Link href={item.href} className="hover:text-slate-700 dark:hover:text-slate-200" lang={item.lang}>
                {item.name}
              </Link>
            ) : (
              <span aria-current="page" className="text-slate-700 dark:text-slate-200" lang={item.lang}>
                {item.name}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
