import { beforeEach, describe, expect, it, vi } from "vitest";

const createFn    = vi.fn();
const findManyFn  = vi.fn();
const deleteManyFn = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    loginEvent: {
      create:     (...a: unknown[]) => createFn(...a),
      findMany:   (...a: unknown[]) => findManyFn(...a),
      deleteMany: (...a: unknown[]) => deleteManyFn(...a),
    },
  },
}));

import { recordLoginEvent, getLoginHistory } from "@/lib/login-event-service";
import { sweepOldLoginEvents } from "@/lib/login-event-sweep";

beforeEach(() => {
  createFn.mockReset();
  findManyFn.mockReset();
  deleteManyFn.mockReset();
});

describe("recordLoginEvent", () => {
  it("insère un événement avec les bonnes données", async () => {
    createFn.mockResolvedValue({});
    await recordLoginEvent({ userId: "u1", ip: "1.2.3.4", userAgent: "Chrome/120", method: "password", success: true });
    expect(createFn).toHaveBeenCalledWith({
      data: { userId: "u1", ip: "1.2.3.4", userAgent: "Chrome/120", method: "password", success: true },
    });
  });

  it("ne lève jamais d'exception si la DB échoue", async () => {
    createFn.mockRejectedValue(new Error("DB error"));
    await expect(
      recordLoginEvent({ userId: "u1", ip: "1.2.3.4", userAgent: "", method: "google", success: true })
    ).resolves.toBeUndefined();
  });
});

describe("getLoginHistory", () => {
  it("retourne les événements mappés avec browser et os", async () => {
    const now = new Date();
    findManyFn.mockResolvedValue([
      { id: "e1", ip: "1.2.3.4", userAgent: "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36", method: "password", success: true, createdAt: now },
    ]);
    const items = await getLoginHistory("u1");
    expect(items).toHaveLength(1);
    expect(items[0].browser).toBe("Chrome");
    expect(items[0].os).toBe("Windows");
    expect(items[0].success).toBe(true);
  });

  it("détecte Firefox et macOS", async () => {
    findManyFn.mockResolvedValue([
      { id: "e2", ip: "5.6.7.8", userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Gecko/20100101 Firefox/121.0", method: "google", success: true, createdAt: new Date() },
    ]);
    const [item] = await getLoginHistory("u1");
    expect(item.browser).toBe("Firefox");
    expect(item.os).toBe("macOS");
  });

  it("passe la limite au findMany", async () => {
    findManyFn.mockResolvedValue([]);
    await getLoginHistory("u1", 5);
    expect(findManyFn).toHaveBeenCalledWith(expect.objectContaining({ take: 5 }));
  });

  it("trie par createdAt desc", async () => {
    findManyFn.mockResolvedValue([]);
    await getLoginHistory("u1");
    expect(findManyFn).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: "desc" } })
    );
  });
});

describe("sweepOldLoginEvents", () => {
  it("supprime les événements de plus de 90 jours", async () => {
    deleteManyFn.mockResolvedValue({ count: 3 });
    const now = new Date("2026-10-04T12:00:00Z");
    await sweepOldLoginEvents(now);
    expect(deleteManyFn).toHaveBeenCalledWith({
      where: { createdAt: { lt: new Date("2026-07-06T12:00:00Z") } },
    });
  });
});
