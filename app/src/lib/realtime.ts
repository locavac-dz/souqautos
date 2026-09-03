// Lot 40 — messagerie en temps réel : pub/sub en mémoire, un seul process
// Node (comme le bus d'événements in-process d'Al Handassa Urban). Suffisant
// tant que l'application reste monolithe à une seule instance ; passerait à
// un broker externe (Redis pub/sub) si un jour plusieurs instances serveur
// devaient partager les abonnements.
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

const subscribers = new Map<string, Set<Listener>>();

export function subscribeToConversation(conversationId: string, listener: Listener): () => void {
  let set = subscribers.get(conversationId);
  if (!set) {
    set = new Set();
    subscribers.set(conversationId, set);
  }
  set.add(listener);

  return () => {
    const current = subscribers.get(conversationId);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) subscribers.delete(conversationId);
  };
}

export function publishToConversation(conversationId: string, event: ConversationEvent): void {
  const set = subscribers.get(conversationId);
  if (!set) return;
  for (const listener of set) listener(event);
}
