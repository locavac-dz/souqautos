import { getTranslations } from "next-intl/server";
import { requirePageTenant } from "@/lib/auth/page-guard";
import { withTenant } from "@/lib/tenant/prisma";
import { statutTOTP } from "@/lib/auth/account";
import { Nav } from "@/app/_components/Nav";
import { FormMotDePasse } from "@/app/compte/_FormMotDePasse";
import { FormDeuxFacteurs } from "@/app/compte/_FormDeuxFacteurs";
import { RevoquerSessions } from "@/app/compte/_RevoquerSessions";

export const dynamic = "force-dynamic";

export default async function ComptePage() {
  // Exige une session (tout utilisateur authentifié gère son propre compte).
  const { s, ctx, session } = await requirePageTenant();
  const t = await getTranslations("compte");
  const statut = await withTenant(s.app, ctx, (tx) =>
    statutTOTP(tx, ctx.organisationId, session.utilisateurId),
  );
  return (
    <main>
      <Nav />
      <h1>{t("titre")}</h1>
      <section>
        <h2>{t("motDePasseTitre")}</h2>
        <FormMotDePasse />
      </section>
      <FormDeuxFacteurs actifInitial={statut?.actif ?? false} />
      <RevoquerSessions />
    </main>
  );
}
