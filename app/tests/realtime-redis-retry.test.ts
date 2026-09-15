import { describe, expect, it, vi } from "vitest";

// Correctif de relecture qualité (Lot 89-94) : un PSUBSCRIBE Redis échoué au
// tout premier abonné ne doit jamais bloquer la diffusion Redis pour le
// reste de la vie du process — la prochaine tentative d'abonnement doit
// retenter. Mock du client Redis, jamais un vrai serveur ici (même
// discipline que realtime.test.ts).
describe("realtime — nouvelle tentative d'abonnement Redis après échec", () => {
  it("retente le PSUBSCRIBE au prochain appel après un échec, sans jamais dupliquer le gestionnaire pmessage", async () => {
    vi.resetModules();

    let psubscribeCallCount = 0;
    let onCallCount = 0;
    const fakeSubscriber = {
      psubscribe: vi.fn(() => {
        psubscribeCallCount += 1;
        if (psubscribeCallCount === 1) return Promise.reject(new Error("connexion refusée"));
        return Promise.resolve(1);
      }),
      on: vi.fn(() => {
        onCallCount += 1;
      }),
    };

    vi.doMock("@/lib/redis", () => ({
      getRedisClient: () => null,
      getRedisSubscriberClient: () => fakeSubscriber,
    }));

    const { subscribeToConversation } = await import("@/lib/realtime");

    // Premier abonné : le PSUBSCRIBE échoue.
    const unsubscribe1 = subscribeToConversation("conv-1", () => {});
    await new Promise((resolve) => setTimeout(resolve, 0));
    unsubscribe1();

    // Second abonné, après l'échec : doit retenter plutôt qu'abandonner.
    const unsubscribe2 = subscribeToConversation("conv-2", () => {});
    await new Promise((resolve) => setTimeout(resolve, 0));
    unsubscribe2();

    expect(fakeSubscriber.psubscribe).toHaveBeenCalledTimes(2);
    // Le gestionnaire pmessage reste enregistré une seule fois, même après
    // une nouvelle tentative — jamais une livraison dupliquée aux abonnés.
    expect(onCallCount).toBe(1);

    vi.doUnmock("@/lib/redis");
  });
});
