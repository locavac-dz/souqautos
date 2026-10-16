import { getTranslations } from "next-intl/server";
import { requirePageTenant } from "@/lib/auth/page-guard";
import { Nav } from "@/app/_components/Nav";
import { FormMotDePasse } from "@/app/compte/_FormMotDePasse";

export const dynamic = "force-dynamic";

export default async function ComptePage() {
  // Exige une session (tout utilisateur authentifié gère son propre compte).
  await requirePageTenant();
  const t = await getTranslations("compte");
  return (
    <main>
      <Nav />
      <h1>{t("titre")}</h1>
      <section>
        <h2>{t("motDePasseTitre")}</h2>
        <FormMotDePasse />
      </section>
    </main>
  );
}
