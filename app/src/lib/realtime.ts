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

type Listener = (event: ConversationEvent) => void;

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

let redisSubscriptionStarted = false;

// Un seul PSUBSCRIBE pour toutes les conversations (pattern `conversation:*`)
// plutôt qu'un SUBSCRIBE par conversation : le nombre de conversations
// actives n'est pas borné, un pattern unique évite de gérer un abonnement
// Redis séparé par conversation en plus des Set locaux ci-dessus. Une
// instance reçoit ainsi des messages pour des conversations sans abonné
// local (un autre navigateur, connecté à une autre instance) — filtrés sans
// effet ci-dessous par `deliverLocally` (Map.get renvoie undefined).
function ensureRedisSubscription(): void {
  if (redisSubscriptionStarted) return;
  const subscriber = getRedisSubscriberClient();
  if (!subscriber) return;
  redisSubscriptionStarted = true;

  subscriber.psubscribe(`${REDIS_CHANNEL_PREFIX}*`).catch((err: Error) => {
    console.error(`[realtime] échec de l'abonnement Redis: ${err.message}`);
  });
  subscriber.on("pmessage", (_pattern: string, channel: string, message: string) => {
    const conversationId = channel.slice(REDIS_CHANNEL_PREFIX.length);
    try {
      deliverLocally(conversationId, JSON.parse(message) as ConversationEvent);
    } catch (err) {
      console.error(`[realtime] message Redis illisible, ignoré: ${(err as Error).message}`);
    }
  });
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
