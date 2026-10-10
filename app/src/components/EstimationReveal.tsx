"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

// L'estimation est déjà calculée côté serveur (pas de secret, pas d'appel réseau au clic) : seul l'affichage
// est différé, pour ne pas l'imposer à qui n'en a pas envie en ouvrant une fiche annonce.
export function EstimationReveal({ children }: { children: React.ReactNode }) {
  const t = useTranslations("PriceBadge");
  const [revealed, setRevealed] = useState(false);

  if (revealed) return <>{children}</>;

  return (
    <button
      type="button"
      onClick={() => setRevealed(true)}
      className="mt-6 rounded-md border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
    >
      {t("showEstimation")}
    </button>
  );
}
