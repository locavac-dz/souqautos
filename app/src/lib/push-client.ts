// Lot 121 — utilitaire du navigateur pour les notifications, isolé pour être testé.

// La clé publique du site est fournie en base64url (texte) ; `pushManager.subscribe` attend des octets.
export function urlBase64ToUint8Array(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = base64url.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(base64url.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export type PushToggleState =
  | "loading"
  | "unsupported" // navigateur sans notifications (ex. iPhone hors application installée)
  | "unavailable" // le site n'a pas de clés d'envoi configurées
  | "no-worker" // service worker absent (développement : il n'est enregistré qu'en production)
  | "denied" // la personne a bloqué les notifications dans son navigateur
  | "off"
  | "on";

// État à afficher, décidé à partir de ce que le navigateur et le serveur ont répondu.
export function decidePushState({
  supported,
  serverEnabled,
  hasWorker,
  permission,
  subscribed,
}: {
  supported: boolean;
  serverEnabled: boolean;
  hasWorker: boolean;
  permission: NotificationPermission;
  subscribed: boolean;
}): PushToggleState {
  if (!supported) return "unsupported";
  if (!serverEnabled) return "unavailable";
  if (!hasWorker) return "no-worker";
  if (subscribed) return "on";
  if (permission === "denied") return "denied";
  return "off";
}
