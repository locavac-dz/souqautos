"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

const DISMISSED_KEY = "souq-auto-launch-notice-dismissed";

// Bandeau temporaire du tout premier lancement : prévient les visiteurs et les renvoie vers
// /contact pour signaler une anomalie. Statique (pas de défilement) — un texte en mouvement
// est moins lisible et pose un problème d'accessibilité (WCAG, contenu qu'on ne peut pas arrêter).
// Fermeture mémorisée par navigateur (pas de réglage serveur : à retirer du code une fois le
// lancement passé).
export function LaunchNoticeBanner() {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    // Lu après montage seulement (indisponible côté serveur, évite un désaccord SSR/client) —
    // même raison que CompareContext/WizardContext.
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDismissed(window.localStorage.getItem(DISMISSED_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  if (dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Stockage indisponible (navigation privée…) : le bandeau réapparaîtra à la page suivante, sans gravité.
    }
  };

  return <LaunchNoticeContent onDismiss={dismiss} />;
}

// Contenu du bandeau, séparé de la logique de fermeture. Un <aside> nommé est un repère (landmark) : sans lui, le
// texte reste hors de tout repère et axe-core signale « region » sur chaque page (audit d'accessibilité e2e).
export function LaunchNoticeContent({ onDismiss }: { onDismiss: () => void }) {
  const t = useTranslations("LaunchNotice");

  return (
    <aside
      aria-label={t("ariaLabel")}
      className="flex items-center justify-center gap-3 bg-amber-100 px-4 py-2 text-center text-sm text-amber-900 dark:bg-amber-900/40 dark:text-amber-100"
    >
      <span>
        {t("message")}{" "}
        <Link href="/contact" className="font-medium underline hover:no-underline">
          {t("reportLink")}
        </Link>
      </span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t("close")}
        className="shrink-0 rounded-md px-1.5 py-0.5 text-amber-900/70 hover:bg-amber-900/10 hover:text-amber-900 dark:text-amber-100/70 dark:hover:bg-amber-100/10 dark:hover:text-amber-100"
      >
        ✕
      </button>
    </aside>
  );
}
