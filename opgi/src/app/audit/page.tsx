import { getTranslations, getMessages } from "next-intl/server";
import { requirePageTenant } from "@/lib/auth/page-guard";
import { withTenant } from "@/lib/tenant/prisma";
import { ROLES_LECTURE_AUDIT } from "@/lib/audit";
import { libelleEnum, type DictEnums } from "@/i18n/enums";
import { Nav } from "@/app/_components/Nav";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
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

  const entries = await withTenant(s.app, ctx, (tx) =>
    tx.auditLog.findMany({
      where: { organisationId: ctx.organisationId },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  );

  return (
    <main>
      <Nav />
      <h1>{t("titre")}</h1>
      <section className="card" aria-label={t("titre")}>
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
        <p className="meta">{t("note")}</p>
      </section>
    </main>
  );
}
