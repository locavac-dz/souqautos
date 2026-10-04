// Lot 241 — tests du service de notifications in-app.
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock Prisma
const createFn    = vi.fn();
const findManyFn  = vi.fn();
const countFn     = vi.fn();
const updateManyFn = vi.fn();
const deleteManyFn = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    userNotification: {
      create:      (...a: unknown[]) => createFn(...a),
      findMany:    (...a: unknown[]) => findManyFn(...a),
      count:       (...a: unknown[]) => countFn(...a),
      updateMany:  (...a: unknown[]) => updateManyFn(...a),
      deleteMany:  (...a: unknown[]) => deleteManyFn(...a),
    },
  },
}));

import {
  createNotification,
  getNotifications,
  getUnreadCount,
  markAllRead,
  markRead,
} from "@/lib/notification-service";
import { sweepOldNotifications } from "@/lib/notification-sweep";

beforeEach(() => {
  createFn.mockReset();
  findManyFn.mockReset();
  countFn.mockReset();
  updateManyFn.mockReset();
  deleteManyFn.mockReset();
});

describe("createNotification", () => {
  it("insère une ligne avec le bon userId, kind et data", async () => {
    createFn.mockResolvedValue({});
    await createNotification("user1", "NEW_MESSAGE", { url: "/fr/compte/messages/x", body: "Peugeot 208" });
    expect(createFn).toHaveBeenCalledWith({
      data: { userId: "user1", kind: "NEW_MESSAGE", data: { url: "/fr/compte/messages/x", body: "Peugeot 208" } },
    });
  });

  it("ne lève jamais d'exception si la DB échoue", async () => {
    createFn.mockRejectedValue(new Error("DB error"));
    await expect(createNotification("user1", "LISTING_APPROVED", { url: "/", body: "test" })).resolves.toBeUndefined();
  });
});

describe("getNotifications", () => {
  it("retourne les notifications mappées correctement", async () => {
    const now = new Date();
    findManyFn.mockResolvedValue([
      { id: "n1", kind: "LISTING_APPROVED", data: { url: "/fr/annonce/x", body: "Clio" }, readAt: null, createdAt: now },
    ]);
    const items = await getNotifications("user1");
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: "n1", kind: "LISTING_APPROVED", data: { url: "/fr/annonce/x" }, readAt: null });
  });

  it("passe la limite au findMany", async () => {
    findManyFn.mockResolvedValue([]);
    await getNotifications("user1", 5);
    expect(findManyFn).toHaveBeenCalledWith(expect.objectContaining({ take: 5 }));
  });
});

describe("getUnreadCount", () => {
  it("appelle count avec readAt null", async () => {
    countFn.mockResolvedValue(3);
    const result = await getUnreadCount("user1");
    expect(result).toBe(3);
    expect(countFn).toHaveBeenCalledWith({ where: { userId: "user1", readAt: null } });
  });
});

describe("markAllRead", () => {
  it("met à jour les notifications non lues de l'utilisateur", async () => {
    updateManyFn.mockResolvedValue({ count: 2 });
    await markAllRead("user1");
    expect(updateManyFn).toHaveBeenCalledWith({
      where: { userId: "user1", readAt: null },
      data: expect.objectContaining({ readAt: expect.any(Date) }),
    });
  });
});

describe("markRead", () => {
  it("met à jour une seule notification par id et userId", async () => {
    updateManyFn.mockResolvedValue({ count: 1 });
    await markRead("user1", "notif-id");
    expect(updateManyFn).toHaveBeenCalledWith({
      where: { id: "notif-id", userId: "user1", readAt: null },
      data: expect.objectContaining({ readAt: expect.any(Date) }),
    });
  });
});

describe("sweepOldNotifications", () => {
  it("supprime les notifications de plus de 30 jours", async () => {
    deleteManyFn.mockResolvedValue({ count: 5 });
    const now = new Date("2026-10-04T12:00:00Z");
    await sweepOldNotifications(now);
    expect(deleteManyFn).toHaveBeenCalledWith({
      where: { createdAt: { lt: new Date("2026-09-04T12:00:00Z") } },
    });
  });
});
