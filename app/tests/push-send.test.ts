import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();
const del = vi.fn();
const update = vi.fn();
const sendNotification = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    pushSubscription: {
      findMany: (...a: unknown[]) => findMany(...a),
      delete: (...a: unknown[]) => del(...a),
      update: (...a: unknown[]) => update(...a),
    },
  },
}));
vi.mock("web-push", () => ({ default: { sendNotification: (...a: unknown[]) => sendNotification(...a) } }));

import { sendPushToUser } from "@/lib/push-send";

const PUBLIC_KEY = "B".repeat(87);
const PRIVATE_KEY = "p".repeat(43);
const payload = { title: "Nouvelle annonce pour votre alerte", body: "Renault Clio — 1 500 000 DA", url: "/fr/annonce/abc", tag: "alert-1" };

const sub = (id: string, endpoint = `https://fcm.googleapis.com/fcm/send/${id}`) => ({
  id,
  userId: "user1",
  endpoint,
  p256dh: "k".repeat(87),
  auth: "a".repeat(22),
  createdAt: new Date(),
  lastSentAt: null,
  userAgent: null,
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  process.env.VAPID_PUBLIC_KEY = PUBLIC_KEY;
  process.env.VAPID_PRIVATE_KEY = PRIVATE_KEY;
  process.env.VAPID_SUBJECT = "mailto:contact@souqauto.example";
  findMany.mockResolvedValue([sub("s1")]);
  sendNotification.mockResolvedValue({ statusCode: 201 });
  del.mockResolvedValue({});
  update.mockResolvedValue({});
});

describe("sendPushToUser", () => {
  it("does nothing, and does not even read the database, without VAPID keys", async () => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    delete process.env.VAPID_SUBJECT;
    expect(await sendPushToUser("user1", payload)).toEqual({ sent: 0, removed: 0, failed: 0 });
    expect(findMany).not.toHaveBeenCalled();
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("does nothing when the user has no subscribed device", async () => {
    findMany.mockResolvedValue([]);
    expect(await sendPushToUser("user1", payload)).toEqual({ sent: 0, removed: 0, failed: 0 });
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("sends the notification to each device, signed with the site's key, with a 24 h lifetime", async () => {
    findMany.mockResolvedValue([sub("s1"), sub("s2")]);
    const result = await sendPushToUser("user1", payload);
    expect(result).toEqual({ sent: 2, removed: 0, failed: 0 });
    expect(sendNotification).toHaveBeenCalledTimes(2);

    const [subscription, body, options] = sendNotification.mock.calls[0];
    expect(subscription.endpoint).toMatch(/^https:\/\/fcm\.googleapis\.com\//);
    expect(subscription.keys).toEqual({ p256dh: "k".repeat(87), auth: "a".repeat(22) });
    expect(JSON.parse(body)).toEqual(payload);
    expect(options).toMatchObject({ TTL: 86400, vapidDetails: { subject: "mailto:contact@souqauto.example", publicKey: PUBLIC_KEY, privateKey: PRIVATE_KEY } });
    expect(update).toHaveBeenCalledTimes(2); // dernier envoi noté
  });

  it("reads at most five devices, the most recent first", async () => {
    await sendPushToUser("user1", payload);
    expect(findMany).toHaveBeenCalledWith({ where: { userId: "user1" }, orderBy: { createdAt: "desc" }, take: 5 });
  });

  it("forgets a device the push service says is gone (404 or 410), without failing the others", async () => {
    findMany.mockResolvedValue([sub("gone404"), sub("gone410"), sub("ok")]);
    sendNotification.mockImplementation(async (s: { endpoint: string }) => {
      if (s.endpoint.endsWith("gone404")) throw Object.assign(new Error("not found"), { statusCode: 404 });
      if (s.endpoint.endsWith("gone410")) throw Object.assign(new Error("gone"), { statusCode: 410 });
      return { statusCode: 201 };
    });
    expect(await sendPushToUser("user1", payload)).toEqual({ sent: 1, removed: 2, failed: 0 });
    expect(del.mock.calls.map((c) => c[0].where.id).sort()).toEqual(["gone404", "gone410"]);
  });

  it("keeps the subscription after a temporary failure (server error, timeout), and counts it as failed", async () => {
    sendNotification.mockRejectedValue(Object.assign(new Error("boom"), { statusCode: 503 }));
    expect(await sendPushToUser("user1", payload)).toEqual({ sent: 0, removed: 0, failed: 1 });
    expect(del).not.toHaveBeenCalled();
  });

  it("never sends to an address that is not a real push service, and removes that row", async () => {
    findMany.mockResolvedValue([sub("evil", "https://169.254.169.254/latest/meta-data/"), sub("ok")]);
    expect(await sendPushToUser("user1", payload)).toEqual({ sent: 1, removed: 1, failed: 0 });
    expect(sendNotification).toHaveBeenCalledTimes(1);
    expect(sendNotification.mock.calls[0][0].endpoint).toContain("fcm.googleapis.com");
    expect(del).toHaveBeenCalledWith({ where: { id: "evil" } });
  });

  it("sanitises what it sends: bounded text and a path of the site only", async () => {
    await sendPushToUser("user1", { title: "T".repeat(500), body: "B".repeat(500), url: "https://evil.example/" });
    const sent = JSON.parse(sendNotification.mock.calls[0][1]);
    expect(sent.title.length).toBeLessThanOrEqual(80);
    expect(sent.body.length).toBeLessThanOrEqual(140);
    expect(sent.url).toBe("/");
  });

  it("never throws, and never logs the secret address of a device", async () => {
    findMany.mockRejectedValue(new Error("db down"));
    await expect(sendPushToUser("user1", payload)).resolves.toEqual({ sent: 0, removed: 0, failed: 0 });

    findMany.mockResolvedValue([sub("s1", "https://fcm.googleapis.com/fcm/send/SECRET-DEVICE-TOKEN")]);
    sendNotification.mockRejectedValue(Object.assign(new Error("boom"), { statusCode: 500 }));
    await sendPushToUser("user1", payload);
    const logged = (console.error as ReturnType<typeof vi.fn>).mock.calls.flat().join(" ");
    expect(logged).toContain("fcm.googleapis.com");
    expect(logged).not.toContain("SECRET-DEVICE-TOKEN");
  });
});
