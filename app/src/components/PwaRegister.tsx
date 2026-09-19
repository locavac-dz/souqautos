"use client";

import { useEffect } from "react";

// Lot 120 — enregistre le service worker (public/sw.js). Uniquement en production : en
// développement, des fichiers aux noms stables mis en cache masqueraient les modifications.
// Un échec d'enregistrement ne doit jamais gêner le site : il est seulement signalé.
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error) => {
      console.warn("[pwa] service worker non enregistré :", error);
    });
  }, []);

  return null;
}
