import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import webpush from "web-push";
import { Prisma } from "@prisma/client";

const upsert = vi.fn();
const findMany = vi.fn();
const deleteMany = vi.fn();
const getCurrentUser = vi.fn();
const checkRateLimit = vi.fn();
const sendPushToUser = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: { pushSubscription: { upsert: (...a: unknown[]) => upsert(...a), findMany: (...a: unknown[]) => findMany(...a), deleteMany: (...a: unknown[]) => deleteMany(...a) } },
}));
vi.mock("@/lib/auth-server/current-user", () => ({ getCurrentUser: () => getCurrentUser() }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: (...a: unknown[]) => checkRateLimit(...a) }));
vi.mock("@/lib/push-send", () => ({ sendPushToUser: (...a: unknown[]) => sendPushToUser(...a) }));
vi.mock("next-intl/server", () => ({ getTranslations: async () => (key: string) => key }));

import { GET as getConfig } from "@/app/api/push/config/route";
import { POST as subscribe, DELETE as unsubscribe } from "@/app/api/push/subscribe/route";
import { POST as sendTest } from "@/app/api/push/test/route";

// Paire générée à la volée : jamais de clé réelle dans le dépôt.
const vapid = webpush.generateVAPIDKeys();

function request(body: unknown, userAgent = "Mozilla/5.0 (Test)"): NextRequest {
  return {
    json: async () => {
      if (body === undefined) throw new Error("no body");
      return body;
    },
    headers: { get: (name: string) => (name.toLowerCase() === "user-agent" ? userAgent : null) },
  } as unknown as NextRequest;
}

// Clés d'abonnement de forme valide (65 octets et 16 octets en base64url).
const validSubscription = {
  endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
  keys: { p256dh: Buffer.alloc(65, 4).toString("base64url"), auth: Buffer.alloc(16, 9).toString("base64url") },
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("VAPID_PUBLIC_KEY", vapid.publicKey);
  vi.stubEnv("VAPID_PRIVATE_KEY", vapid.privateKey);
  vi.stubEnv("VAPID_SUBJECT", "mailto:contact@souqauto.example");
  getCurrentUser.mockResolvedValue({ id: "user1", locale: "fr" });
  checkRateLimit.mockResolvedValue(true);
  upsert.mockResolvedValue({});
  findMany.mockResolvedValue([{ id: "s1" }]);
  deleteMany.mockResolvedValue({ count: 1 });
  sendPushToUser.mockResolvedValue({ sent: 1, removed: 0, failed: 0 });
});

describe("GET /api/push/config", () => {
  it("gives the PUBLIC key when configured, never the private one", async () => {
    const res = await getConfig();
    expect(res.headers.get("cache-control")).toBe("no-store");
    const text = JSON.stringify(await res.json());
    expect(JSON.parse(text)).toEqual({ enabled: true, publicKey: vapid.publicKey });
    expect(text).not.toContain(vapid.privateKey);
  });

  it("reports the feature as disabled without keys, and also when the configuration is broken", async () => {
    vi.stubEnv("VAPID_PUBLIC_KEY", "");
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    vi.stubEnv("VAPID_SUBJECT", "");
    expect(await (await getConfig()).json()).toEqual({ enabled: false });
    vi.stubEnv("VAPID_PUBLIC_KEY", "trop-court");
    vi.stubEnv("VAPID_PRIVATE_KEY", vapid.privateKey);
    vi.stubEnv("VAPID_SUBJECT", "mailto:contact@souqauto.example");
    expect(await (await getConfig()).json()).toEqual({ enabled: false });
  });
});

describe("POST /api/push/subscribe", () => {
  it("registers the device for the connected user, keeping the browser name for the account page", async () => {
    const res = await subscribe(request(validSubscription));
    expect(res.status).toBe(201);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(upsert).toHaveBeenCalledWith({
      where: { endpoint: validSubscription.endpoint },
      create: { userId: "user1", endpoint: validSubscription.endpoint, p256dh: validSubscription.keys.p256dh, auth: validSubscription.keys.auth, userAgent: "Mozilla/5.0 (Test)" },
      update: { userId: "user1", p256dh: validSubscription.keys.p256dh, auth: validSubscription.keys.auth, userAgent: "Mozilla/5.0 (Test)" },
    });
  });

  it("moves a device to the account now using it (the previous account stops receiving on it)", async () => {
    await subscribe(request(validSubscription));
    const call = upsert.mock.calls[0][0] as { update: { userId: string } };
    expect(call.update.userId).toBe("user1");
  });

  it("requires a connection", async () => {
    getCurrentUser.mockResolvedValue(null);
    const res = await subscribe(request(validSubscription));
    expect(res.status).toBe(401);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("is rate limited per user", async () => {
    checkRateLimit.mockResolvedValue(false);
    const res = await subscribe(request(validSubscription));
    expect(res.status).toBe(429);
    expect(checkRateLimit).toHaveBeenCalledWith("push-subscribe:user1", expect.objectContaining({ limit: 20 }));
    expect(upsert).not.toHaveBeenCalled();
  });

  it("answers 503 when the site has no push keys, before touching the database", async () => {
    vi.stubEnv("VAPID_PUBLIC_KEY", "");
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    vi.stubEnv("VAPID_SUBJECT", "");
    const res = await subscribe(request(validSubscription));
    expect(res.status).toBe(503);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("refuses a push address that is not a real notification service (server-side request forgery)", async () => {
    for (const endpoint of [
      "http://127.0.0.1:5433/",
      "https://localhost/x",
      "https://169.254.169.254/latest/meta-data",
      "http://fcm.googleapis.com/fcm/send/abc", // pas de https
      "https://fcm.googleapis.com.evil.example/x",
      "https://user:pass@fcm.googleapis.com/x",
      "https://fcm.googleapis.com:8443/x",
    ]) {
      const res = await subscribe(request({ ...validSubscription, endpoint }));
      expect(res.status, endpoint).toBe(400);
    }
    expect(upsert).not.toHaveBeenCalled();
  });

  it("refuses malformed keys and bodies that are not JSON", async () => {
    expect((await subscribe(request({ ...validSubscription, keys: { p256dh: "x", auth: "y" } }))).status).toBe(400);
    expect((await subscribe(request({ endpoint: validSubscription.endpoint }))).status).toBe(400);
    expect((await subscribe(request(undefined))).status).toBe(400);
    expect((await subscribe(request(null))).status).toBe(400);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("keeps only the 5 most recent devices of an account", async () => {
    findMany.mockResolvedValue(Array.from({ length: 7 }, (_, i) => ({ id: `s${i}` })));
    await subscribe(request(validSubscription));
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "user1" }, orderBy: { createdAt: "desc" } }));
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["s5", "s6"] } } });
  });

  it("does not delete anything when the account is within the limit", async () => {
    findMany.mockResolvedValue(Array.from({ length: 5 }, (_, i) => ({ id: `s${i}` })));
    await subscribe(request(validSubscription));
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it("treats a simultaneous double registration (unique violation) as success", async () => {
    upsert.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("Unique constraint", { code: "P2002", clientVersion: "test" }));
    const res = await subscribe(request(validSubscription));
    expect(res.status).toBe(201);
  });

  it("does not hide other database errors", async () => {
    upsert.mockRejectedValue(new Error("connection lost"));
    const res = await subscribe(request(validSubscription));
    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/push/subscribe", () => {
  it("removes only devices that belong to the connected user", async () => {
    const res = await unsubscribe(request({ endpoint: validSubscription.endpoint }));
    expect(res.status).toBe(200);
    expect(deleteMany).toHaveBeenCalledWith({ where: { endpoint: validSubscription.endpoint, userId: "user1" } });
    expect(await res.json()).toEqual({ ok: true, removed: 1 });
  });

  it("reports 0 removed for a device of another account, without revealing that it exists", async () => {
    deleteMany.mockResolvedValue({ count: 0 });
    const res = await unsubscribe(request({ endpoint: "https://fcm.googleapis.com/fcm/send/someone-else" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, removed: 0 });
  });

  it("requires a connection and a valid body", async () => {
    expect((await unsubscribe(request({ endpoint: "x" }))).status).toBe(200);
    expect((await unsubscribe(request({}))).status).toBe(400);
    expect((await unsubscribe(request({ endpoint: "x".repeat(5000) }))).status).toBe(400);
    getCurrentUser.mockResolvedValue(null);
    expect((await unsubscribe(request({ endpoint: "x" }))).status).toBe(401);
  });
});

describe("POST /api/push/test", () => {
  it("sends a test notification to the devices of the connected user, in their language", async () => {
    getCurrentUser.mockResolvedValue({ id: "user1", locale: "ar" });
    const res = await sendTest();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sent: 1, removed: 0, failed: 0 });
    expect(sendPushToUser).toHaveBeenCalledWith("user1", { title: "pushTestTitle", body: "pushTestBody", url: "/ar/compte/alertes", tag: "push-test", lang: "ar" });
  });

  it("requires a connection, is rate limited, and answers 503 without keys", async () => {
    getCurrentUser.mockResolvedValue(null);
    expect((await sendTest()).status).toBe(401);
    getCurrentUser.mockResolvedValue({ id: "user1", locale: "fr" });
    checkRateLimit.mockResolvedValue(false);
    expect((await sendTest()).status).toBe(429);
    checkRateLimit.mockResolvedValue(true);
    vi.stubEnv("VAPID_PUBLIC_KEY", "");
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    vi.stubEnv("VAPID_SUBJECT", "");
    expect((await sendTest()).status).toBe(503);
    expect(sendPushToUser).not.toHaveBeenCalled();
  });
});
