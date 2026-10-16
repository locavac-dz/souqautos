import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getServerSession } from "@/lib/auth/next-session";
import { getServices } from "@/lib/services";
import { resolveTenant } from "@/lib/tenant/resolve";
import { withTenant } from "@/lib/tenant/prisma";
import { listNotifications } from "@/lib/modules/notifications";
import { Nav } from "@/app/_components/Nav";
import { BoutonLu } from "@/app/notifications/_BoutonLu";

export const dynamic = "force-dynamic";

function quand(d: Date): string {
  return d.toISOString().replace("T", " ").slice(0, 16);
}

export default async function NotificationsPage() {
  const session = await getServerSession();
  if (!session) redirect("/connexion");
  const t = await getTranslations("notifications");
  const s = getServices();
  const ctx = resolveTenant(session, s.config);

  const notifications = await withTenant(s.app, ctx, (tx) =>
    listNotifications(tx, ctx.organisationId, { utilisateurId: session.utilisateurId, role: session.role }),
  );

  return (
    <main>
      <Nav />
      <h1>{t("titre")}</h1>
      <section className="card" aria-label={t("titre")}>
        {notifications.length === 0 ? (
          <p>{t("aucune")}</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {notifications.map((n) => (
              <li
                key={n.id}
                style={{
                  borderBottom: "1px solid var(--border)",
                  padding: "10px 0",
                  fontWeight: n.lu ? 400 : 700,
                }}
              >
                <div>
                  {!n.lu && <span aria-label={t("nonLue")}>● </span>}
                  {n.lien ? <Link href={n.lien}>{n.titre}</Link> : n.titre}
                </div>
                {n.corps && <div className="meta">{n.corps}</div>}
                <div className="meta" style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 4 }}>
                  <span>{quand(n.createdAt)}</span>
                  {!n.lu && <BoutonLu id={n.id} />}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
