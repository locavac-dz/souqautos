import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getServerSession } from "@/lib/auth/next-session";
import { getServices } from "@/lib/services";
import { resolveTenant } from "@/lib/tenant/resolve";
import { withTenant } from "@/lib/tenant/prisma";
import { can, type RoleName } from "@/lib/authz/permissions";
import { Nav } from "@/app/_components/Nav";

// Dépend de la session/base : jamais prérendu.
export const dynamic = "force-dynamic";

export default async function TableauDeBord() {
  const session = await getServerSession();
  if (!session) redirect("/connexion");

  const t = await getTranslations("tableauDeBord");
  const s = getServices();
  const ctx = resolveTenant(session, s.config);
  const peutLirePatrimoine = can(session.role as RoleName, "A", "lire");

  const biens = peutLirePatrimoine
    ? await withTenant(s.app, ctx, (tx) =>
        tx.bien.findMany({
          orderBy: { code: "asc" },
          select: { id: true, code: true, type: true, etatOccupation: true, adresse: true },
        }),
      )
    : [];

  return (
    <main>
      <Nav />
      <h1>{t("titre")}</h1>

      <p className="meta">
        {t("organismeActif")} : <strong>{ctx.organisationId}</strong> — {t("role")} :{" "}
        <strong>{session.role}</strong>
      </p>

      <section className="card" aria-label={t("biens")}>
        <h2>{t("biens")}</h2>
        {!peutLirePatrimoine ? (
          <p role="alert">{t("accesRefuse")}</p>
        ) : biens.length === 0 ? (
          <p>{t("aucunBien")}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">{t("colCode")}</th>
                <th scope="col">{t("colType")}</th>
                <th scope="col">{t("colEtat")}</th>
                <th scope="col">{t("colAdresse")}</th>
              </tr>
            </thead>
            <tbody>
              {biens.map((b) => (
                <tr key={b.id}>
                  <td>{b.code}</td>
                  <td>{b.type}</td>
                  <td>{b.etatOccupation}</td>
                  <td>{b.adresse ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
