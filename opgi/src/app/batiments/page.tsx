import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requirePageTenant } from "@/lib/auth/page-guard";
import { withTenant } from "@/lib/tenant/prisma";
import { listBatiments, listSites } from "@/lib/modules/a/service";
import { can, type RoleName } from "@/lib/authz/permissions";
import { Nav } from "@/app/_components/Nav";
import { BoutonArchiver } from "@/app/_components/BoutonArchiver";

export const dynamic = "force-dynamic";

export default async function BatimentsPage() {
  const { session, s, ctx } = await requirePageTenant();
  const t = await getTranslations("batiments");
  const tc = await getTranslations("commun");
  const role = session.role as RoleName;

  if (!can(role, "A", "lire")) {
    return (
      <main>
        <Nav />
        <p role="alert">{tc("accesRefuse")}</p>
      </main>
    );
  }

  const [batiments, sites] = await withTenant(s.app, ctx, async (tx) => [
    await listBatiments(tx, ctx.organisationId),
    await listSites(tx, ctx.organisationId),
  ]);
  const siteLabel = new Map(sites.map((x) => [x.id, `${x.code} — ${x.nom}`]));
  const peutModifier = can(role, "A", "modifier");

  return (
    <main>
      <Nav />
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <h1>{t("titre")}</h1>
        {can(role, "A", "creer") && <Link href="/batiments/nouveau">{tc("nouveau")}</Link>}
      </header>

      <section className="card" aria-label={t("titre")}>
        {batiments.length === 0 ? (
          <p>{t("aucun")}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">{t("code")}</th>
                <th scope="col">{t("nom")}</th>
                <th scope="col">{t("site")}</th>
                {peutModifier && <th scope="col">{tc("actions")}</th>}
              </tr>
            </thead>
            <tbody>
              {batiments.map((x) => (
                <tr key={x.id}>
                  <td>{x.code}</td>
                  <td>{x.nom}</td>
                  <td>{siteLabel.get(x.siteId) ?? "—"}</td>
                  {peutModifier && (
                    <td>
                      <BoutonArchiver url={`/api/batiments/${x.id}`} />
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
