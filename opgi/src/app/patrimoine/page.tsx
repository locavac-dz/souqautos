import Link from "next/link";
import { getTranslations, getMessages } from "next-intl/server";
import { requirePageTenant } from "@/lib/auth/page-guard";
import { withTenant } from "@/lib/tenant/prisma";
import { listBiens } from "@/lib/modules/a/service";
import { can, type RoleName } from "@/lib/authz/permissions";
import { libelleEnum, type DictEnums } from "@/i18n/enums";
import { Nav } from "@/app/_components/Nav";
import { BoutonArchiver } from "@/app/_components/BoutonArchiver";

export const dynamic = "force-dynamic";

export default async function PatrimoinePage() {
  const { session, s, ctx } = await requirePageTenant();
  const t = await getTranslations("patrimoine");
  const tc = await getTranslations("commun");
  const enums = (await getMessages()).enums as DictEnums;
  const role = session.role as RoleName;

  if (!can(role, "A", "lire")) {
    return (
      <main>
        <Nav />
        <p role="alert">{tc("accesRefuse")}</p>
      </main>
    );
  }

  const biens = await withTenant(s.app, ctx, (tx) => listBiens(tx, ctx.organisationId));
  const peutModifier = can(role, "A", "modifier");

  return (
    <main>
      <Nav />
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <h1>{t("titre")}</h1>
        <span style={{ display: "flex", gap: 12 }}>
          {can(role, "A", "exporter") && <a href="/api/export?type=biens">{tc("exporterCsv")}</a>}
          {can(role, "A", "creer") && <Link href="/patrimoine/import">{t("importer")}</Link>}
          {can(role, "A", "creer") && <Link href="/patrimoine/nouveau">{tc("nouveau")}</Link>}
        </span>
      </header>

      <section className="card" aria-label={t("titre")}>
        {biens.length === 0 ? (
          <p>{tc("aucun")}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">{t("code")}</th>
                <th scope="col">{t("type")}</th>
                <th scope="col">{t("etat")}</th>
                <th scope="col">{t("adresse")}</th>
                {peutModifier && <th scope="col">{tc("actions")}</th>}
              </tr>
            </thead>
            <tbody>
              {biens.map((b) => (
                <tr key={b.id}>
                  <td>{b.code}</td>
                  <td>{t(`type${b.type}`)}</td>
                  <td>{libelleEnum(enums, "etatOccupation", b.etatOccupation)}</td>
                  <td>{b.adresse ?? "—"}</td>
                  {peutModifier && (
                    <td>
                      <BoutonArchiver url={`/api/biens/${b.id}`} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
