import type { Instrumentation } from "next";

// Lot 136 — appelé par Next.js à chaque erreur du SERVEUR (page, API, action de formulaire).
// Prévient l'équipe technique par courriel, avec des garde-fous contre l'inondation : src/lib/server-error-alerts.ts.
//
// Node.js seulement (le module lit la base de limites et envoie des courriels) ; l'envoi n'est PAS attendu : le serveur
// tourne en continu (pas de fonction éphémère qui s'arrêterait avant l'envoi), et une alerte lente ne doit pas
// retarder la réponse d'erreur faite au visiteur.
export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  // Le bloc « if (NEXT_RUNTIME === "nodejs") » est le motif documenté par Next.js : webpack remplace la constante à chaque
  // compilation et SUPPRIME le bloc dans le bundle « edge » (où node:crypto, Prisma, nodemailer n'existent pas). Un retour
  // anticipé (`if (… !== "nodejs") return;`) ne suffit pas : le code qui suit reste compilé pour l'edge, et le serveur de
  // développement ne démarre plus (UnhandledSchemeError: node:crypto). `webpackIgnore` contournait cela au prix d'un
  // import laissé tel quel, que Node ne sait pas résoudre (« Cannot find package '@/lib' », alertes jamais envoyées).
  if (process.env.NEXT_RUNTIME === "nodejs") {
    void import("@/lib/server-error-alerts").then(({ reportServerError }) => reportServerError(error, request, context));
  }
};
