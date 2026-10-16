import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requirePageTenant } from "@/lib/auth/page-guard";
import { withTenant } from "@/lib/tenant/prisma";
import { listProjets, listEntreprises } from "@/lib/modules/b/service";
import { can, type RoleName } from "@/lib/authz/permissions";
import { Nav } from "@/app/_components/Nav";
import { FormMarche } from "@/app/marches/_FormMarche";

export const dynamic = "force-dynamic";

export default async function NouveauMarchePage() {
  const { session, s, ctx } = await requirePageTenant();
  const t = await getTranslations("marches");
  const tc = await getTranslations("commun");
  const role = session.role as RoleName;

  if (!can(role, "B", "creer")) {
    return (
      <main>
        <Nav />
        <p role="alert">Votre rôle ne permet pas de créer un marché.</p>
      </main>
    );
  }

  const [projets, entreprises] = await withTenant(s.app, ctx, async (tx) => [
    await listProjets(tx, ctx.organisationId),
    await listEntreprises(tx, ctx.organisationId),
  ]);

  const projetsOpt = projets.map((p) => ({ id: p.id, label: `${p.code} — ${p.intitule}` }));
  const entreprisesOpt = entreprises.map((e) => ({ id: e.id, label: e.raisonSociale }));

  return (
    <main>
      <Nav />
      <p>
        <Link href="/marches">{tc("retour")}</Link>
      </p>
      <h1>{t("nouveauTitre")}</h1>
      {projetsOpt.length === 0 || entreprisesOpt.length === 0 ? (
        <p role="alert">Créez d'abord un projet et une entreprise.</p>
      ) : (
        <FormMarche projets={projetsOpt} entreprises={entreprisesOpt} />
      )}
    </main>
  );
}
