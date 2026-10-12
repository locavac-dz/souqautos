import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/redis", () => ({
  getRedisClient: () => null,
  getRedisSubscriberClient: () => null,
}));

describe("notification realtime pub/sub (in-memory fallback)", () => {
  let subscribeToUserNotifications: typeof import("@/lib/realtime").subscribeToUserNotifications;
  let publishToUserNotifications: typeof import("@/lib/realtime").publishToUserNotifications;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("@/lib/realtime");
    subscribeToUserNotifications = mod.subscribeToUserNotifications;
    publishToUserNotifications = mod.publishToUserNotifications;
  });

  it("delivers a notification event to a subscriber", async () => {
    const received: Array<{ type: string; count: number }> = [];
    const unsub = subscribeToUserNotifications("user-1", (e) => received.push(e));

    await publishToUserNotifications("user-1", { type: "new", count: 3 });
    expect(received).toEqual([{ type: "new", count: 3 }]);

    unsub();
  });

  it("does not deliver to unsubscribed listeners", async () => {
    const received: Array<{ type: string; count: number }> = [];
    const unsub = subscribeToUserNotifications("user-2", (e) => received.push(e));

    unsub();
    await publishToUserNotifications("user-2", { type: "new", count: 1 });
    expect(received).toEqual([]);
  });

  it("does not cross-deliver between users", async () => {
    const receivedA: Array<{ type: string; count: number }> = [];
    const receivedB: Array<{ type: string; count: number }> = [];
    const unsubA = subscribeToUserNotifications("user-a", (e) => receivedA.push(e));
    const unsubB = subscribeToUserNotifications("user-b", (e) => receivedB.push(e));

    await publishToUserNotifications("user-a", { type: "new", count: 5 });
    expect(receivedA).toHaveLength(1);
    expect(receivedB).toHaveLength(0);

    unsubA();
    unsubB();
  });

  it("supports multiple subscribers for the same user", async () => {
    const r1: Array<{ type: string; count: number }> = [];
    const r2: Array<{ type: string; count: number }> = [];
    const unsub1 = subscribeToUserNotifications("user-m", (e) => r1.push(e));
    const unsub2 = subscribeToUserNotifications("user-m", (e) => r2.push(e));

    await publishToUserNotifications("user-m", { type: "new", count: 2 });
    expect(r1).toHaveLength(1);
    expect(r2).toHaveLength(1);

    unsub1();
    unsub2();
  });
});

describe("NotificationKind FAVORITE_PRICE_DROP", () => {
  it("is a valid Prisma enum value", async () => {
    const { NotificationKind } = await import("@prisma/client");
    expect(NotificationKind.FAVORITE_PRICE_DROP).toBe("FAVORITE_PRICE_DROP");
  });
});
