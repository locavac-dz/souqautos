import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requirePageTenant } from "@/lib/auth/page-guard";
import { withTenant } from "@/lib/tenant/prisma";
import { listOccupants } from "@/lib/modules/a/service";
import { can, type RoleName } from "@/lib/authz/permissions";
import { Nav } from "@/app/_components/Nav";
import { BoutonArchiver } from "@/app/_components/BoutonArchiver";

export const dynamic = "force-dynamic";

export default async function OccupantsPage() {
  const { session, s, ctx } = await requirePageTenant();
  const t = await getTranslations("occupants");
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

  const occupants = await withTenant(s.app, ctx, (tx) => listOccupants(tx, ctx.organisationId));
  const peutModifier = can(role, "A", "modifier");

  return (
    <main>
      <Nav />
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <h1>{t("titre")}</h1>
        {can(role, "A", "creer") && <Link href="/occupants/nouveau">{tc("nouveau")}</Link>}
      </header>

      <section className="card" aria-label={t("titre")}>
        {occupants.length === 0 ? (
          <p>{tc("aucun")}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">{t("nom")}</th>
                <th scope="col">{t("prenom")}</th>
                <th scope="col">{t("type")}</th>
                <th scope="col">{t("telephone")}</th>
                <th scope="col">{t("email")}</th>
                {peutModifier && <th scope="col">{tc("actions")}</th>}
              </tr>
            </thead>
            <tbody>
              {occupants.map((o) => (
                <tr key={o.id}>
                  <td>{o.nom}</td>
                  <td>{o.prenom ?? "—"}</td>
                  <td>{t(`type${o.type}`)}</td>
                  <td>{o.telephone ?? "—"}</td>
                  <td>{o.email ?? "—"}</td>
                  {peutModifier && (
                    <td>
                      <BoutonArchiver url={`/api/occupants/${o.id}`} />
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
