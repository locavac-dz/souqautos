import Link from "next/link";
import { getTranslations, getMessages } from "next-intl/server";
import { requirePageTenant } from "@/lib/auth/page-guard";
import { withTenant } from "@/lib/tenant/prisma";
import { ROLES_LECTURE_AUDIT, listAudit, countAudit, type AuditListeOpts } from "@/lib/audit";
import { libelleEnum, type DictEnums } from "@/i18n/enums";
import { Nav } from "@/app/_components/Nav";

export const dynamic = "force-dynamic";

const PER_PAGE = 50;

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; resultat?: string; page?: string }>;
}) {
  const { session, s, ctx } = await requirePageTenant();
  const t = await getTranslations("audit");
  const enums = (await getMessages()).enums as DictEnums;

  if (!ROLES_LECTURE_AUDIT.has(session.role)) {
    return (
      <main>
        <Nav />
        <p role="alert">{t("accesRefuse")}</p>
      </main>
    );
  }

  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const resultat: "SUCCES" | "ECHEC" | undefined =
    sp.resultat === "SUCCES" || sp.resultat === "ECHEC" ? sp.resultat : undefined;
  const page = Math.max(Number(sp.page) || 1, 1);
  const opts: AuditListeOpts = { q, resultat, skip: (page - 1) * PER_PAGE, take: PER_PAGE };

  const [entries, total] = await withTenant(s.app, ctx, async (tx) => [
    await listAudit(tx, ctx.organisationId, opts),
    await countAudit(tx, ctx.organisationId, opts),
  ]);
  const pages = Math.max(Math.ceil(total / PER_PAGE), 1);
  const lien = (p: number) => {
    const u = new URLSearchParams();
    if (q) u.set("q", q);
    if (resultat) u.set("resultat", resultat);
    u.set("page", String(p));
    return `/audit?${u.toString()}`;
  };

  return (
    <main>
      <Nav />
      <h1>{t("titre")}</h1>
      <form className="card" method="get" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
        <span>
          <label htmlFor="q">{t("rechercheLabel")}</label>
          <input id="q" name="q" defaultValue={q ?? ""} placeholder={t("recherchePlaceholder")} />
        </span>
        <span>
          <label htmlFor="resultat">{t("resultat")}</label>
          <select id="resultat" name="resultat" defaultValue={resultat ?? ""}>
            <option value="">{t("resultatTous")}</option>
            <option value="SUCCES">{libelleEnum(enums, "resultatAudit", "SUCCES")}</option>
            <option value="ECHEC">{libelleEnum(enums, "resultatAudit", "ECHEC")}</option>
          </select>
        </span>
        <button type="submit">{t("filtrer")}</button>
      </form>
      <section className="card" aria-label={t("titre")}>
        <p className="meta">{t("total")} : {total}</p>
        {entries.length === 0 ? (
          <p>{t("aucun")}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">{t("date")}</th>
                <th scope="col">{t("action")}</th>
                <th scope="col">{t("objet")}</th>
                <th scope="col">{t("resultat")}</th>
                <th scope="col">{t("resume")}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td>{e.createdAt.toISOString().replace("T", " ").slice(0, 19)}</td>
                  <td>{e.action}</td>
                  <td>
                    {e.objetType}
                    {e.objetId ? ` (${e.objetId.slice(0, 8)})` : ""}
                  </td>
                  <td>{libelleEnum(enums, "resultatAudit", e.resultat)}</td>
                  <td>{e.resume ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <nav aria-label="pagination" style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 12 }}>
          {page > 1 && <Link href={lien(page - 1)}>{t("precedent")}</Link>}
          <span className="meta">
            {page} / {pages}
          </span>
          {page < pages && <Link href={lien(page + 1)}>{t("suivant")}</Link>}
        </nav>
        <p className="meta">{t("note")}</p>
      </section>
    </main>
  );
}
