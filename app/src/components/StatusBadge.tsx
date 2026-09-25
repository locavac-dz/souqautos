import { getTranslations } from "next-intl/server";
import type { ListingStatus } from "@prisma/client";

const STATUS_STYLE: Record<ListingStatus, string> = {
  BROUILLON: "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300",
  EN_ATTENTE: "bg-amber-50 text-amber-700",
  PUBLIEE: "bg-emerald-50 text-emerald-700",
  SUSPENDUE: "bg-orange-50 text-orange-700",
  REFUSEE: "bg-red-50 text-red-700",
  VENDUE: "bg-blue-50 text-blue-700",
  EXPIREE: "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400",
};

export async function StatusBadge({ status }: { status: ListingStatus }) {
  const t = await getTranslations("Status");
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[status]}`}>{t(status)}</span>
  );
}
