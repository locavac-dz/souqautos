import { getRedisClient, getRedisSubscriberClient } from "./redis";

// Messagerie en temps réel — pub/sub Redis quand REDIS_URL est configurée
// (diffuse entre toutes les instances de l'application), repli en mémoire
// sinon (comme avant ce lot, un seul process Node). Le repli reste aussi
// actif si Redis devient injoignable au moment de la publication.
export type ConversationEvent =
  | {
      type: "message";
      message: {
        id: string;
        senderId: string;
        content: string;
        attachmentUrl: string | null;
        deletedAt: null;
        createdAt: string;
      };
    }
  | { type: "delete"; messageId: string };

// Lot 252 — événements de groupe
export type GroupEvent =
  | {
      type: "message";
      message: {
        id: string;
        senderId: string;
        senderName: string;
        content: string;
        attachmentUrl: string | null;
        audioUrl: string | null;
        deletedAt: null;
        createdAt: string;
      };
    }
  | { type: "delete"; messageId: string }
  | { type: "member_added"; member: { userId: string; userName: string; isAdmin: boolean } }
  | { type: "member_removed"; userId: string };

type Listener = (event: ConversationEvent) => void;
type GroupListener = (event: GroupEvent) => void;

// Abonnés de CETTE instance uniquement — un navigateur connecté en SSE parle
// toujours à une seule instance à la fois, jamais besoin de les partager
// entre process. C'est le canal Redis ci-dessous qui fait le lien entre
// instances : chacune republie localement ce qu'elle reçoit du canal.
const localSubscribers = new Map<string, Set<Listener>>();

const REDIS_CHANNEL_PREFIX = "conversation:";

function deliverLocally(conversationId: string, event: ConversationEvent): void {
  const set = localSubscribers.get(conversationId);
  if (!set) return;
  for (const listener of set) listener(event);
}

let pmessageHandlerRegistered = false;
// `null` tant qu'aucun abonnement n'est en cours/réussi — distinct d'un
// simple booléen pour pouvoir RETENTER : si le PSUBSCRIBE échoue (Redis
// injoignable au moment précis du tout premier abonné), remis à `null` pour
// que le prochain appel relance une tentative, plutôt que d'abandonner
// silencieusement et définitivement la diffusion Redis pour le reste de vie
// du process.
let redisSubscriptionPromise: Promise<void> | null = null;

// Un seul PSUBSCRIBE pour toutes les conversations (pattern `conversation:*`)
// plutôt qu'un SUBSCRIBE par conversation : le nombre de conversations
// actives n'est pas borné, un pattern unique évite de gérer un abonnement
// Redis séparé par conversation en plus des Set locaux ci-dessus. Une
// instance reçoit ainsi des messages pour des conversations sans abonné
// local (un autre navigateur, connecté à une autre instance) — filtrés sans
// effet ci-dessous par `deliverLocally` (Map.get renvoie undefined).
function ensureRedisSubscription(): void {
  const subscriber = getRedisSubscriberClient();
  if (!subscriber) return;

  // Enregistré une seule fois, indépendamment du succès/échec du
  // PSUBSCRIBE — jamais dupliqué par une nouvelle tentative (qui livrerait
  // alors chaque message plusieurs fois aux abonnés locaux).
  if (!pmessageHandlerRegistered) {
    pmessageHandlerRegistered = true;
    subscriber.on("pmessage", (_pattern: string, channel: string, message: string) => {
      const conversationId = channel.slice(REDIS_CHANNEL_PREFIX.length);
      try {
        deliverLocally(conversationId, JSON.parse(message) as ConversationEvent);
      } catch (err) {
        console.error(`[realtime] message Redis illisible, ignoré: ${(err as Error).message}`);
      }
    });
  }

  if (redisSubscriptionPromise) return;
  redisSubscriptionPromise = subscriber.psubscribe(`${REDIS_CHANNEL_PREFIX}*`).then(
    () => undefined,
    (err: Error) => {
      console.error(`[realtime] échec de l'abonnement Redis, nouvelle tentative au prochain appel: ${err.message}`);
      redisSubscriptionPromise = null;
    }
  );
}

export function subscribeToConversation(conversationId: string, listener: Listener): () => void {
  ensureRedisSubscription();

  let set = localSubscribers.get(conversationId);
  if (!set) {
    set = new Set();
    localSubscribers.set(conversationId, set);
  }
  set.add(listener);

  return () => {
    const current = localSubscribers.get(conversationId);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) localSubscribers.delete(conversationId);
  };
}

export async function publishToConversation(conversationId: string, event: ConversationEvent): Promise<void> {
  const redis = getRedisClient();
  if (!redis) {
    deliverLocally(conversationId, event);
    return;
  }

  try {
    // La publication repasse par Redis même pour CETTE instance (jamais un
    // deliverLocally direct en plus) : le canal PSUBSCRIBE ci-dessus la
    // recevra en retour comme n'importe quelle autre instance abonnée, un
    // seul chemin de livraison plutôt que deux à garder synchronisés.
    await redis.publish(`${REDIS_CHANNEL_PREFIX}${conversationId}`, JSON.stringify(event));
  } catch (err) {
    console.error(`[realtime] Redis indisponible, repli diffusion locale: ${(err as Error).message}`);
    deliverLocally(conversationId, event);
  }
}

// --- Lot 252 — pub/sub pour les groupes (même architecture, préfixe "group:") ---

const localGroupSubscribers = new Map<string, Set<GroupListener>>();
const REDIS_GROUP_PREFIX = "group:";

function deliverGroupLocally(groupId: string, event: GroupEvent): void {
  const set = localGroupSubscribers.get(groupId);
  if (!set) return;
  for (const listener of set) listener(event);
}

let groupPmessageHandlerRegistered = false;
let groupRedisSubscriptionPromise: Promise<void> | null = null;

function ensureGroupRedisSubscription(): void {
  const subscriber = getRedisSubscriberClient();
  if (!subscriber) return;

  if (!groupPmessageHandlerRegistered) {
    groupPmessageHandlerRegistered = true;
    subscriber.on("pmessage", (_pattern: string, channel: string, message: string) => {
      if (!channel.startsWith(REDIS_GROUP_PREFIX)) return;
      const groupId = channel.slice(REDIS_GROUP_PREFIX.length);
      try {
        deliverGroupLocally(groupId, JSON.parse(message) as GroupEvent);
      } catch (err) {
        console.error(`[realtime/group] message Redis illisible, ignoré: ${(err as Error).message}`);
      }
    });
  }

  if (groupRedisSubscriptionPromise) return;
  groupRedisSubscriptionPromise = subscriber.psubscribe(`${REDIS_GROUP_PREFIX}*`).then(
    () => undefined,
    (err: Error) => {
      console.error(`[realtime/group] échec abonnement Redis: ${err.message}`);
      groupRedisSubscriptionPromise = null;
    }
  );
}

export function subscribeToGroup(groupId: string, listener: GroupListener): () => void {
  ensureGroupRedisSubscription();

  let set = localGroupSubscribers.get(groupId);
  if (!set) {
    set = new Set();
    localGroupSubscribers.set(groupId, set);
  }
  set.add(listener);

  return () => {
    const current = localGroupSubscribers.get(groupId);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) localGroupSubscribers.delete(groupId);
  };
}

export async function publishToGroup(groupId: string, event: GroupEvent): Promise<void> {
  const redis = getRedisClient();
  if (!redis) {
    deliverGroupLocally(groupId, event);
    return;
  }

  try {
    await redis.publish(`${REDIS_GROUP_PREFIX}${groupId}`, JSON.stringify(event));
  } catch (err) {
    console.error(`[realtime/group] Redis indisponible, repli local: ${(err as Error).message}`);
    deliverGroupLocally(groupId, event);
  }
}

// --- Lot 295 — pub/sub pour les notifications utilisateur (badge temps réel) ---

export type NotificationEvent = { type: "new"; count: number };

type NotificationListener = (event: NotificationEvent) => void;

const localNotifSubscribers = new Map<string, Set<NotificationListener>>();
const REDIS_NOTIF_PREFIX = "notification:";

function deliverNotifLocally(userId: string, event: NotificationEvent): void {
  const set = localNotifSubscribers.get(userId);
  if (!set) return;
  for (const listener of set) listener(event);
}

let notifPmessageHandlerRegistered = false;
let notifRedisSubscriptionPromise: Promise<void> | null = null;

function ensureNotifRedisSubscription(): void {
  const subscriber = getRedisSubscriberClient();
  if (!subscriber) return;

  if (!notifPmessageHandlerRegistered) {
    notifPmessageHandlerRegistered = true;
    subscriber.on("pmessage", (_pattern: string, channel: string, message: string) => {
      if (!channel.startsWith(REDIS_NOTIF_PREFIX)) return;
      const userId = channel.slice(REDIS_NOTIF_PREFIX.length);
      try {
        deliverNotifLocally(userId, JSON.parse(message) as NotificationEvent);
      } catch (err) {
        console.error(`[realtime/notif] message Redis illisible, ignoré: ${(err as Error).message}`);
      }
    });
  }

  if (notifRedisSubscriptionPromise) return;
  notifRedisSubscriptionPromise = subscriber.psubscribe(`${REDIS_NOTIF_PREFIX}*`).then(
    () => undefined,
    (err: Error) => {
      console.error(`[realtime/notif] échec abonnement Redis: ${err.message}`);
      notifRedisSubscriptionPromise = null;
    }
  );
}

export function subscribeToUserNotifications(userId: string, listener: NotificationListener): () => void {
  ensureNotifRedisSubscription();

  let set = localNotifSubscribers.get(userId);
  if (!set) {
    set = new Set();
    localNotifSubscribers.set(userId, set);
  }
  set.add(listener);

  return () => {
    const current = localNotifSubscribers.get(userId);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) localNotifSubscribers.delete(userId);
  };
}

export async function publishToUserNotifications(userId: string, event: NotificationEvent): Promise<void> {
  const redis = getRedisClient();
  if (!redis) {
    deliverNotifLocally(userId, event);
    return;
  }

  try {
    await redis.publish(`${REDIS_NOTIF_PREFIX}${userId}`, JSON.stringify(event));
  } catch (err) {
    console.error(`[realtime/notif] Redis indisponible, repli local: ${(err as Error).message}`);
    deliverNotifLocally(userId, event);
  }
}
