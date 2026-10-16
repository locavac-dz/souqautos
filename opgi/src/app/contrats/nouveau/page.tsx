import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requirePageTenant } from "@/lib/auth/page-guard";
import { withTenant } from "@/lib/tenant/prisma";
import { listBiens, listOccupants } from "@/lib/modules/a/service";
import { can, type RoleName } from "@/lib/authz/permissions";
import { Nav } from "@/app/_components/Nav";
import { FormContrat } from "@/app/contrats/_FormContrat";

export const dynamic = "force-dynamic";

export default async function NouveauContratPage() {
  const { session, s, ctx } = await requirePageTenant();
  const t = await getTranslations("contrats");
  const tc = await getTranslations("commun");
  const role = session.role as RoleName;

  if (!can(role, "A", "creer")) {
    return (
      <main>
        <Nav />
        <p role="alert">{tc("accesRefuse")}</p>
      </main>
    );
  }

  const [biens, occupants] = await withTenant(s.app, ctx, async (tx) => [
    await listBiens(tx, ctx.organisationId),
    await listOccupants(tx, ctx.organisationId),
  ]);

  const biensOpt = biens.map((b) => ({ id: b.id, label: `${b.code} — ${b.type}` }));
  const occupantsOpt = occupants.map((o) => ({
    id: o.id,
    label: o.prenom ? `${o.nom} ${o.prenom}` : o.nom,
  }));

  return (
    <main>
      <Nav />
      <p>
        <Link href="/contrats">{tc("retour")}</Link>
      </p>
      <h1>{t("nouveauTitre")}</h1>
      {biensOpt.length === 0 || occupantsOpt.length === 0 ? (
        <p role="alert">{t("aucunBienOccupant")}</p>
      ) : (
        <FormContrat biens={biensOpt} occupants={occupantsOpt} />
      )}
    </main>
  );
}
