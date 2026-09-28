"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

// Détecte quand le service worker change de version (controllerchange sur un controller
// déjà présent = mise à jour, pas la première installation) et propose de recharger.
export function PwaUpdateBanner() {
  const [visible, setVisible] = useState(false);
  const t = useTranslations("Pwa");

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const prev = navigator.serviceWorker.controller;
    if (!prev) return; // première installation : pas de bandeau
    const handler = () => {
      if (navigator.serviceWorker.controller !== prev) setVisible(true);
    };
    navigator.serviceWorker.addEventListener("controllerchange", handler);
    return () => navigator.serviceWorker.removeEventListener("controllerchange", handler);
  }, []);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg bg-slate-900 px-4 py-3 shadow-lg dark:bg-white"
    >
      <span className="text-sm text-white dark:text-slate-900">{t("updateAvailable")}</span>
      <button
        onClick={() => window.location.reload()}
        className="rounded-md bg-white px-3 py-1 text-sm font-medium text-slate-900 hover:opacity-90 dark:bg-slate-900 dark:text-white"
      >
        {t("reload")}
      </button>
    </div>
  );
}
