import Link from "next/link";
import { getTranslations, getMessages } from "next-intl/server";
import { requirePageTenant } from "@/lib/auth/page-guard";
import { withTenant } from "@/lib/tenant/prisma";
import { listMarches } from "@/lib/modules/b/service";
import { can, type RoleName } from "@/lib/authz/permissions";
import { libelleEnum, type DictEnums } from "@/i18n/enums";
import { Nav } from "@/app/_components/Nav";

export const dynamic = "force-dynamic";

export default async function MarchesPage() {
  const { session, s, ctx } = await requirePageTenant();
  const t = await getTranslations("marches");
  const tc = await getTranslations("commun");
  const enums = (await getMessages()).enums as DictEnums;
  const role = session.role as RoleName;

  if (!can(role, "B", "lire")) {
    return (
      <main>
        <Nav />
        <p role="alert">Votre rôle ne permet pas d'accéder au module B.</p>
      </main>
    );
  }

  const marches = await withTenant(s.app, ctx, (tx) => listMarches(tx, ctx.organisationId));

  return (
    <main>
      <Nav />
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <h1>{t("titre")}</h1>
        {can(role, "B", "creer") && <Link href="/marches/nouveau">{tc("nouveau")}</Link>}
      </header>
      <section className="card" aria-label={t("titre")}>
        {marches.length === 0 ? (
          <p>{t("aucun")}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">{t("reference")}</th>
                <th scope="col">{t("objet")}</th>
                <th scope="col">{t("statut")}</th>
                <th scope="col">{tc("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {marches.map((m) => (
                <tr key={m.id}>
                  <td>{m.reference}</td>
                  <td>{m.objet}</td>
                  <td>{libelleEnum(enums, "statutMarche", m.statut)}</td>
                  <td>
                    <Link href={`/marches/${m.id}`}>{t("voir")}</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
