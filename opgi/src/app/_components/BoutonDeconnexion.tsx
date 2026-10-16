"use client";

import { useTranslations } from "next-intl";

export function BoutonDeconnexion() {
  const t = useTranslations("tableauDeBord");
  async function deconnexion() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/connexion");
  }
  return (
    <button type="button" onClick={deconnexion}>
      {t("deconnexion")}
    </button>
  );
}
