import { describe, expect, it, vi } from "vitest";
import { subscribeToConversation, publishToConversation, type ConversationEvent } from "@/lib/realtime";

// Sans REDIS_URL configurée, publishToConversation reste sur son repli de
// diffusion locale — exactement le comportement d'avant le passage à Redis
// (Lot 90). Le vrai chemin pub/sub Redis (diffusion ENTRE deux process) est
// vérifié manuellement en conditions réelles, jamais ici.
function uniqueId(): string {
  return `test-${Math.random().toString(36).slice(2)}`;
}

const sampleEvent: ConversationEvent = { type: "delete", messageId: "m1" };

describe("realtime (repli en mémoire)", () => {
  it("délivre un événement publié à un abonné de la même conversation", async () => {
    const conversationId = uniqueId();
    const received: ConversationEvent[] = [];
    const unsubscribe = subscribeToConversation(conversationId, (event) => received.push(event));

    await publishToConversation(conversationId, sampleEvent);

    expect(received).toEqual([sampleEvent]);
    unsubscribe();
  });

  it("délivre à tous les abonnés d'une même conversation", async () => {
    const conversationId = uniqueId();
    const receivedA: ConversationEvent[] = [];
    const receivedB: ConversationEvent[] = [];
    const unsubA = subscribeToConversation(conversationId, (event) => receivedA.push(event));
    const unsubB = subscribeToConversation(conversationId, (event) => receivedB.push(event));

    await publishToConversation(conversationId, sampleEvent);

    expect(receivedA).toEqual([sampleEvent]);
    expect(receivedB).toEqual([sampleEvent]);
    unsubA();
    unsubB();
  });

  it("ne délivre jamais un événement à une autre conversation", async () => {
    const conversationId = uniqueId();
    const otherConversationId = uniqueId();
    const received: ConversationEvent[] = [];
    const unsubscribe = subscribeToConversation(conversationId, (event) => received.push(event));

    await publishToConversation(otherConversationId, sampleEvent);

    expect(received).toEqual([]);
    unsubscribe();
  });

  it("arrête la livraison après désabonnement", async () => {
    const conversationId = uniqueId();
    const listener = vi.fn();
    const unsubscribe = subscribeToConversation(conversationId, listener);
    unsubscribe();

    await publishToConversation(conversationId, sampleEvent);

    expect(listener).not.toHaveBeenCalled();
  });

  it("ne fait rien quand une conversation n'a aucun abonné", async () => {
    await expect(publishToConversation(uniqueId(), sampleEvent)).resolves.toBeUndefined();
  });
});
