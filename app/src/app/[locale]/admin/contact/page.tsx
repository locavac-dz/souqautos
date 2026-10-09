import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { isStaff } from "@/lib/auth-server/roles";
import { ContactMessageActions } from "@/components/admin/ContactMessageActions";
import { CONTACT_SUBJECT_KEY } from "@/lib/contact-messages";
import type { ContactMessage, ContactStatus } from "@prisma/client";

// Lot 273 — file des messages de contact : nouveaux et pris en charge (plus anciens d'abord), puis les 20 derniers
// répondus. Chaque ligne porte la référence citée au client et un lien « Répondre » qui ouvre un courriel pré-adressé.
const ANSWERED_SHOWN = 20;

const STATUS_CLASS: Record<ContactStatus, string> = {
  NOUVEAU: "bg-amber-50 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  PRIS_EN_CHARGE: "bg-sky-50 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
  REPONDU: "bg-emerald-50 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
};

type Row = ContactMessage & { handledBy: { email: string } | null };

export default async function AdminContactPage() {
  const locale = await getLocale();
  // Lot 276 — réservé à l’équipe de modération : un rédacteur (EDITEUR) entre dans /admin mais pas ici.
  const viewer = await getCurrentUser();
  if (!viewer || !isStaff(viewer.role)) {
    redirect({ href: "/admin/mag", locale });
    return null;
  }
  const t = await getTranslations("Admin");
  const tContact = await getTranslations("Contact");

  const [open, answered] = await Promise.all([
    prisma.contactMessage.findMany({
      where: { status: { in: ["NOUVEAU", "PRIS_EN_CHARGE"] } },
      orderBy: { createdAt: "asc" },
      include: { handledBy: { select: { email: true } } },
    }),
    prisma.contactMessage.findMany({
      where: { status: "REPONDU" },
      orderBy: { answeredAt: "desc" },
      take: ANSWERED_SHOWN,
      include: { handledBy: { select: { email: true } } },
    }),
  ]);

  const dateFormatter = new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : "fr-DZ", { dateStyle: "medium", timeStyle: "short" });

  const renderRow = (m: Row) => (
    <div key={m.id} className="flex flex-col gap-4 rounded-lg border border-slate-200 dark:border-slate-700 p-3 sm:flex-row">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-slate-700 dark:text-slate-300">{m.reference}</span>
          <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[m.status]}`}>{t(`contactStatus_${m.status}`)}</span>
          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700 dark:bg-slate-700 dark:text-slate-200">
            {tContact(`subject_${CONTACT_SUBJECT_KEY[m.subject]}`)}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">{m.locale.toUpperCase()}</span>
        </div>
        <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
          {m.name} ·{" "}
          <a
            href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: [${m.reference}] Souq Auto`)}`}
            className="font-normal text-emerald-700 hover:underline dark:text-emerald-400"
          >
            {m.email}
          </a>
        </p>
        <p className="mt-1 whitespace-pre-wrap rounded bg-slate-50 dark:bg-slate-800 p-2 text-sm text-slate-700 dark:text-slate-300" dir="auto">
          {m.message}
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {t("contactReceivedOn", { date: dateFormatter.format(m.createdAt) })}
          {m.handledBy && <> · {t("contactHandledBy", { email: m.handledBy.email })}</>}
          {!m.ackSentAt && <> · {t("contactAckPending")}</>}
        </p>
        {m.note && <p className="mt-1 text-xs italic text-slate-500 dark:text-slate-400">{m.note}</p>}
      </div>
      <div className="sm:w-60 sm:shrink-0">
        <a
          href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: [${m.reference}] Souq Auto`)}`}
          className="mb-2 inline-block text-sm font-medium text-slate-900 underline dark:text-slate-100"
        >
          {t("contactReplyByEmail")}
        </a>
        <ContactMessageActions messageId={m.id} status={m.status} note={m.note} />
      </div>
    </div>
  );

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-4">
          {t("contactQueueTitle")} ({open.length})
        </h1>
        {open.length === 0 ? (
          <p className="text-slate-500 dark:text-slate-400 text-sm">{t("noContactMessages")}</p>
        ) : (
          <div className="space-y-3">{open.map(renderRow)}</div>
        )}
      </section>
      {answered.length > 0 && (
        <section>
          <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-4">{t("contactAnsweredSection")}</h2>
          <div className="space-y-3">{answered.map(renderRow)}</div>
        </section>
      )}
    </div>
  );
}
