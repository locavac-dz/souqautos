import { createECDH } from "node:crypto";
import { z } from "zod";

// Lot 121 — notifications push (Web Push) : logique pure, testée sans réseau ni base.

// --- Adresse du service de notification ---------------------------------------------------
//
// À l'abonnement, l'APPAREIL fournit l'adresse (`endpoint`) à laquelle le serveur enverra ses
// notifications. Si on l'acceptait telle quelle, n'importe quel utilisateur pourrait y mettre
// l'adresse d'un serveur interne (SSRF) : notre serveur lui enverrait alors des requêtes. On
// n'accepte donc que les services de notification réels des navigateurs, en https.
const PUSH_HOST_SUFFIXES = [
  "fcm.googleapis.com", // Chrome, Edge, Brave, Opera, Samsung Internet, Android
  "push.services.mozilla.com", // Firefox
  "notify.windows.com", // Edge (Windows)
  "push.apple.com", // Safari (iOS 16.4+, macOS)
];

export const MAX_ENDPOINT_LENGTH = 2000;

export function isAllowedPushEndpoint(endpoint: string): boolean {
  if (endpoint.length > MAX_ENDPOINT_LENGTH) return false;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (url.username || url.password) return false;
  if (url.port && url.port !== "443") return false;
  const host = url.hostname.toLowerCase();
  return PUSH_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

// --- Abonnement envoyé par le navigateur ---------------------------------------------------
//
// `p256dh` : point public P-256 non compressé (65 octets → 87 caractères base64url) ;
// `auth` : secret de 16 octets (22 caractères). Les longueurs sont vérifiées pour refuser tout de
// suite une valeur inventée au lieu d'échouer plus tard à l'envoi.
const base64url = (min: number, max: number) => z.string().regex(/^[A-Za-z0-9_-]+$/).min(min).max(max);

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().refine(isAllowedPushEndpoint, { message: "Service de notification non reconnu." }),
  keys: z.object({
    p256dh: base64url(80, 90),
    auth: base64url(20, 24),
  }),
});

export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;

// Au plus ce nombre d'appareils par compte (téléphone, ordinateur, tablette…) ; au-delà, les plus
// anciens sont supprimés.
export const MAX_SUBSCRIPTIONS_PER_USER = 5;

// --- Clés VAPID ---------------------------------------------------------------------------
//
// Paire de clés propre au site : elle prouve aux services de notification que les messages
// viennent bien de nous. Sans elle, les notifications sont simplement désactivées.
export type PushConfig =
  | { mode: "enabled"; publicKey: string; privateKey: string; subject: string }
  | { mode: "disabled" }
  | { mode: "error"; reason: string };

type Env = Record<string, string | undefined>;

export function resolvePushConfig(env: Env): PushConfig {
  const publicKey = env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = env.VAPID_PRIVATE_KEY?.trim();
  const subject = env.VAPID_SUBJECT?.trim();

  if (!publicKey && !privateKey && !subject) return { mode: "disabled" };

  if (!publicKey || !privateKey) {
    return { mode: "error", reason: "VAPID_PUBLIC_KEY et VAPID_PRIVATE_KEY doivent être définies ensemble." };
  }
  if (!/^[A-Za-z0-9_-]{87}$/.test(publicKey)) {
    return { mode: "error", reason: "VAPID_PUBLIC_KEY n'est pas une clé publique valide (87 caractères base64url)." };
  }
  if (!/^[A-Za-z0-9_-]{43}$/.test(privateKey)) {
    return { mode: "error", reason: "VAPID_PRIVATE_KEY n'est pas une clé privée valide (43 caractères base64url)." };
  }
  if (!subject || !/^(mailto:[^\s@]+@[^\s@]+\.[^\s@]+|https:\/\/\S+)$/.test(subject)) {
    return { mode: "error", reason: "VAPID_SUBJECT doit être une adresse « mailto:… » ou une adresse https:// de contact." };
  }
  return { mode: "enabled", publicKey, privateKey, subject };
}

// La clé privée doit être celle qui correspond à la clé publique : sinon les services de notification
// refusent chaque envoi, sans qu'aucune erreur ne soit visible côté site. Vérifié par `npm run launch:check`.
export function vapidKeysMatch(publicKey: string, privateKey: string): boolean {
  try {
    const ecdh = createECDH("prime256v1");
    ecdh.setPrivateKey(Buffer.from(privateKey, "base64url"));
    return ecdh.getPublicKey().equals(Buffer.from(publicKey, "base64url"));
  } catch {
    return false;
  }
}

// --- Contenu d'une notification ------------------------------------------------------------

export type PushPayload = {
  title: string;
  body: string;
  // Chemin du site à ouvrir au clic (jamais une adresse extérieure).
  url: string;
  // Deux notifications de même `tag` se remplacent au lieu de s'empiler.
  tag?: string;
  lang?: "fr" | "ar";
};

const TITLE_MAX = 80;
const BODY_MAX = 140;

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

// Un message chiffré ne peut pas dépasser environ 4 Ko : titre et texte sont bornés, et `url` doit
// être un chemin du site.
export function buildPushPayload(input: PushPayload): PushPayload {
  const url = input.url.startsWith("/") && !input.url.startsWith("//") ? input.url : "/";
  return {
    title: truncate(input.title, TITLE_MAX),
    body: truncate(input.body, BODY_MAX),
    url,
    ...(input.tag ? { tag: input.tag.slice(0, 80) } : {}),
    ...(input.lang ? { lang: input.lang } : {}),
  };
}
