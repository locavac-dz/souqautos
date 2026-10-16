import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BoutonDeconnexion } from "@/app/_components/BoutonDeconnexion";

export async function Nav() {
  const t = await getTranslations("nav");
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
      <span style={{ marginInlineStart: "auto" }}>
        <BoutonDeconnexion />
      </span>
    </nav>
  );
}
