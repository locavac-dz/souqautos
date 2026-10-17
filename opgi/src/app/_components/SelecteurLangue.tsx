"use client";

import { useTranslations } from "next-intl";

// Bascule la langue en posant le cookie `NEXT_LOCALE` puis en rechargeant la
// page (le serveur relit le cookie côté `src/i18n/request.ts`). Pas d'état
// sensible : simple préférence d'affichage par navigateur.
export function SelecteurLangue() {
  const t = useTranslations("langue");

  function choisir(locale: "fr" | "ar") {
    document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=31536000; samesite=lax`;
    window.location.reload();
  }

  return (
    <span aria-label={t("titre")} style={{ display: "inline-flex", gap: 8 }}>
      <button type="button" onClick={() => choisir("fr")} lang="fr">
        {t("francais")}
      </button>
      <button type="button" onClick={() => choisir("ar")} lang="ar">
        {t("arabe")}
      </button>
    </span>
  );
}
