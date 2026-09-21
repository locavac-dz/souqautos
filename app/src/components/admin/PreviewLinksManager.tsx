"use client";

import { useId, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

// Lot 146 — création, copie et révocation des liens de relecture d'un contenu non publié (src/lib/article-preview-links.ts).
// Le jeton n'existe qu'au moment de la création : il est montré ICI, une fois, puis oublié (la liste, elle, n'en contient jamais).

export type PreviewLinkRow = {
  id: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
  createdBy: string;
  state: "active" | "expired" | "revoked";
};

const DAYS = [1, 3, 7, 14, 30] as const;
const STATE_STYLE = { active: "bg-emerald-100 text-emerald-900", expired: "bg-slate-100 text-slate-700", revoked: "bg-red-100 text-red-900" } as const;

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function CopyableLink({ label, url }: { label: string; url: string }) {
  const t = useTranslations("PreviewLinks");
  const [copied, setCopied] = useState(false);
  const id = useId(); // le libellé est RELIÉ à son champ : un lecteur d'écran annonce « Version française », pas un champ sans nom
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-slate-700 mb-1">
        {label}
      </label>
      <div className="flex gap-2">
        <input id={id} readOnly value={url} dir="ltr" onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 rounded-md border border-slate-300 bg-slate-50 px-2 py-1.5 text-xs text-slate-800" />
        <button
          type="button"
          onClick={async () => {
            if (await copyText(url)) {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }
          }}
          className="shrink-0 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          {copied ? t("copied") : t("copy")}
        </button>
      </div>
    </div>
  );
}

export function PreviewLinksManager({ articleId, links }: { articleId: string; links: PreviewLinkRow[] }) {
  const t = useTranslations("PreviewLinks");
  const locale = useLocale();
  const router = useRouter();
  const [days, setDays] = useState<number>(7);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ fr: string; ar: string; expiresAt: string } | null>(null);

  const dateTime = new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : "fr-DZ", { dateStyle: "medium", timeStyle: "short" });

  async function handleCreate() {
    setPending(true);
    setError(null);
    setCreated(null);
    const res = await fetch(`/api/admin/blog/${articleId}/preview-links`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ days }) }).catch(() => null);
    setPending(false);
    if (res?.status === 201) {
      const body = (await res.json()) as { paths: { fr: string; ar: string }; link: { expiresAt: string } };
      setCreated({ fr: window.location.origin + body.paths.fr, ar: window.location.origin + body.paths.ar, expiresAt: body.link.expiresAt });
      router.refresh();
      return;
    }
    const code = res ? ((await res.json().catch(() => null)) as { error?: string } | null)?.error : null;
    setError(code === "too_many" ? t("errorTooMany") : code === "already_published" ? t("errorPublished") : t("errorGeneric"));
  }

  async function handleRevoke(linkId: string) {
    if (!window.confirm(t("revokeConfirm"))) return;
    const res = await fetch(`/api/admin/blog/${articleId}/preview-links/${linkId}`, { method: "DELETE" }).catch(() => null);
    if (res?.ok) router.refresh();
    else setError(t("errorGeneric"));
  }

  return (
    <section className="mt-10 rounded-lg border border-slate-200 p-4" aria-labelledby="preview-links-title">
      <h2 id="preview-links-title" className="text-base font-semibold text-slate-900">
        {t("title")}
      </h2>
      <p className="mt-1 text-sm text-slate-600">{t("intro")}</p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="preview-link-days" className="block text-xs font-medium text-slate-700 mb-1">
            {t("durationLabel")}
          </label>
          <select id="preview-link-days" value={days} onChange={(e) => setDays(Number(e.target.value))} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
            {DAYS.map((d) => (
              <option key={d} value={d}>
                {t(`days${d}` as "days1")}
              </option>
            ))}
          </select>
        </div>
        <button type="button" onClick={handleCreate} disabled={pending} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50">
          {pending ? t("creating") : t("create")}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {created && (
        <div className="mt-4 space-y-3 rounded-md border border-amber-300 bg-amber-50 p-3" role="status">
          <p className="text-sm font-semibold text-amber-950">{t("createdTitle")}</p>
          <p className="text-xs text-amber-900">
            {t("createdWarning")} ({t("expiresOn", { date: dateTime.format(new Date(created.expiresAt)) })})
          </p>
          <CopyableLink label={t("linkFr")} url={created.fr} />
          <CopyableLink label={t("linkAr")} url={created.ar} />
        </div>
      )}

      <h3 className="mt-6 text-sm font-semibold text-slate-900">{t("listTitle")}</h3>
      {links.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">{t("none")}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {links.map((link) => (
            <li key={link.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-700">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className={`rounded px-2 py-0.5 font-medium ${STATE_STYLE[link.state]}`}>{t(link.state === "active" ? "stateActive" : link.state === "expired" ? "stateExpired" : "stateRevoked")}</span>
                <span>{t("expiresOn", { date: dateTime.format(new Date(link.expiresAt)) })}</span>
                <span>{link.lastUsedAt ? t("usedOn", { date: dateTime.format(new Date(link.lastUsedAt)) }) : t("neverUsed")}</span>
                <span className="text-slate-500">{t("createdBy", { email: link.createdBy })}</span>
              </div>
              {link.state === "active" && (
                <button type="button" onClick={() => handleRevoke(link.id)} className="text-red-700 underline hover:text-red-900">
                  {t("revoke")}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
