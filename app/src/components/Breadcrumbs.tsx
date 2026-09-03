import { Link } from "@/i18n/navigation";

export function Breadcrumbs({ items }: { items: { name: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4 text-sm text-slate-500">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, index) => (
          <li key={index} className="flex items-center gap-1">
            {index > 0 && <span className="text-slate-300">/</span>}
            {item.href ? (
              <Link href={item.href} className="hover:text-slate-700">
                {item.name}
              </Link>
            ) : (
              <span className="text-slate-700">{item.name}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
