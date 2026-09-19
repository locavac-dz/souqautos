"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { classifyPublicPath } from "@/lib/analytics";

const ENDPOINT = "/api/analytics/collect";

// Minimisation : du site de provenance, seul son nom de domaine part (pas son chemin ni sa requête,
// qui peuvent contenir une recherche ou un jeton).
function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

// Lot 124 — signale au serveur qu'une page publique a été vue, pour la mesure d'audience du site.
//
// Ce qui part : le chemin de la page (jamais la requête `?…`, qui peut contenir des recherches) et
// le nom de domaine du site de provenance. Rien n'est stocké dans le navigateur : ni cookie, ni stockage local, ni
// identifiant. Rien n'est envoyé si le visiteur a activé « Ne pas me suivre » ou le Global Privacy
// Control, ni pour les pages qui ne sont pas publiques (compte, publication, administration).
export function PageViewTracker() {
  const pathname = usePathname();
  const isFirstPage = useRef(true);
  const previousPath = useRef<string | null>(null);
  const lastReported = useRef<string | null>(null);

  useEffect(() => {
    if (lastReported.current === pathname) return; // double exécution des effets en développement
    lastReported.current = pathname;

    const cameFrom = isFirstPage.current ? originOf(document.referrer) : previousPath.current ? window.location.origin : "";
    isFirstPage.current = false;
    previousPath.current = pathname;

    if (!classifyPublicPath(pathname)) return;
    const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
    if (nav.doNotTrack === "1" || nav.globalPrivacyControl === true) return;

    const body = JSON.stringify({ path: pathname, referrer: cameFrom });
    try {
      if (!nav.sendBeacon?.(ENDPOINT, new Blob([body], { type: "text/plain" }))) {
        void fetch(ENDPOINT, { method: "POST", body, keepalive: true }).catch(() => undefined);
      }
    } catch {
      /* la mesure ne doit jamais gêner la navigation */
    }
  }, [pathname]);

  return null;
}
