import type { Instrumentation } from "next";

// Lot 136 — appelé par Next.js à chaque erreur du SERVEUR (page, API, action de formulaire).
// Prévient l'équipe technique par courriel, avec des garde-fous contre l'inondation : src/lib/server-error-alerts.ts.
//
// Node.js seulement (le module lit la base de limites et envoie des courriels) ; l'envoi n'est PAS attendu : le serveur
// tourne en continu (pas de fonction éphémère qui s'arrêterait avant l'envoi), et une alerte lente ne doit pas
// retarder la réponse d'erreur faite au visiteur.
export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  void import("@/lib/server-error-alerts").then(({ reportServerError }) => reportServerError(error, request, context));
};
