import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BoutonDeconnexion } from "@/app/_components/BoutonDeconnexion";
import { getServerSession } from "@/lib/auth/next-session";
import { getServices } from "@/lib/services";
import { resolveTenant } from "@/lib/tenant/resolve";
import { withTenant } from "@/lib/tenant/prisma";
import { compteNonLues } from "@/lib/modules/notifications";

async function nombreNonLues(): Promise<number> {
  try {
    const session = await getServerSession();
    if (!session) return 0;
    const s = getServices();
    const ctx = resolveTenant(session, s.config);
    return await withTenant(s.app, ctx, (tx) =>
      compteNonLues(tx, ctx.organisationId, { utilisateurId: session.utilisateurId, role: session.role }),
    );
  } catch {
    return 0;
  }
}

export async function Nav() {
  const t = await getTranslations("nav");
  const nonLues = await nombreNonLues();
  return (
    <nav
      aria-label="Navigation principale"
      style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 20, flexWrap: "wrap" }}
    >
      <Link href="/tableau-de-bord">{t("tableauDeBord")}</Link>
      <Link href="/patrimoine">{t("patrimoine")}</Link>
      <Link href="/occupants">{t("occupants")}</Link>
      <Link href="/contrats">{t("contrats")}</Link>
      <Link href="/reclamations">{t("reclamations")}</Link>
      <Link href="/recouvrement">{t("recouvrement")}</Link>
      <Link href="/projets">{t("projets")}</Link>
      <Link href="/entreprises">{t("entreprises")}</Link>
      <Link href="/marches">{t("marches")}</Link>
      <Link href="/audit">{t("audit")}</Link>
      <Link href="/notifications">
        {t("notifications")}
        {nonLues > 0 ? ` (${nonLues})` : ""}
      </Link>
      <Link href="/compte">{t("compte")}</Link>
      <span style={{ marginInlineStart: "auto" }}>
        <BoutonDeconnexion />
      </span>
    </nav>
  );
}
