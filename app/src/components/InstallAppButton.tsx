"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { decideInstallOffer, isIosDevice, isStandaloneDisplay } from "@/lib/pwa";

// Événement non standard, émis par Chrome/Edge/Android quand le site est installable.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const noopSubscribe = () => () => {};

// Lot 120 — proposition d'installation de l'application, dans le pied de page. Un bouton quand
// le navigateur le permet (Chrome, Edge, Android), une explication sur iPhone/iPad (Safari
// n'a pas de bouton), et rien si l'application est déjà installée ou non installable.
export function InstallAppButton() {
  const t = useTranslations("Pwa");
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  // Lus dans le navigateur seulement (`false` pendant le rendu serveur : pas de décalage à l'hydratation).
  const ios = useSyncExternalStore(noopSubscribe, () => isIosDevice(navigator.userAgent, navigator.maxTouchPoints), () => false);
  const standalone = useSyncExternalStore(
    noopSubscribe,
    () =>
      isStandaloneDisplay({
        displayModeStandalone: window.matchMedia("(display-mode: standalone)").matches,
        iosStandalone: (navigator as Navigator & { standalone?: boolean }).standalone,
      }),
    () => false
  );

  useEffect(() => {
    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault(); // on affichera notre propre bouton, au bon endroit
      setPrompt(event as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setInstalled(true);
      setPrompt(null);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const offer = decideInstallOffer({ standalone: standalone || installed, hasPrompt: prompt !== null, ios });
  if (offer === "none") return null;

  if (offer === "ios-hint") {
    return <span className="text-slate-500 dark:text-slate-400">{t("iosHint")}</span>;
  }

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    setPrompt(null); // l'invite ne peut servir qu'une fois
  }

  return (
    <button type="button" onClick={install} className="text-start hover:text-slate-700 dark:hover:text-slate-200 hover:underline">
      {t("install")}
    </button>
  );
}
