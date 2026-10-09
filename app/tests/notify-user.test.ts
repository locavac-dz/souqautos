// Lot 271 — notifyUser : courriel (meilleur effort) + push + notification in-app en un appel.
import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendEmailBestEffort, sendPushToUser, createNotification } = vi.hoisted(() => ({
  sendEmailBestEffort: vi.fn(),
  sendPushToUser: vi.fn(),
  createNotification: vi.fn(),
}));
vi.mock("@/lib/mailer", () => ({ sendEmailBestEffort: (...a: unknown[]) => sendEmailBestEffort(...a) }));
vi.mock("@/lib/push-send", () => ({ sendPushToUser: (...a: unknown[]) => sendPushToUser(...a) }));
vi.mock("@/lib/notification-service", () => ({ createNotification: (...a: unknown[]) => createNotification(...a) }));

import { notifyUser } from "@/lib/notify-user";

beforeEach(() => {
  sendEmailBestEffort.mockReset().mockResolvedValue(null);
  sendPushToUser.mockReset().mockResolvedValue({ sent: 1, removed: 0, failed: 0 });
  createNotification.mockReset().mockResolvedValue(undefined);
});

describe("notifyUser", () => {
  it("envoie les trois canaux, avec la même URL pour le push et l'in-app", async () => {
    await notifyUser({
      userId: "u1",
      kind: "OFFER_RECEIVED",
      url: "/fr/compte/offres",
      body: "Renault Clio",
      email: { tag: "offre", to: "v@example.dz", subject: "Nouvelle offre", html: "<p>…</p>" },
      push: { title: "Offre", body: "1 200 000 DA", tag: "offer-1", lang: "fr" },
    });

    expect(sendEmailBestEffort).toHaveBeenCalledWith("offre", { to: "v@example.dz", subject: "Nouvelle offre", html: "<p>…</p>" });
    expect(sendPushToUser).toHaveBeenCalledWith("u1", {
      title: "Offre",
      body: "1 200 000 DA",
      tag: "offer-1",
      lang: "fr",
      url: "/fr/compte/offres",
    });
    expect(createNotification).toHaveBeenCalledWith("u1", "OFFER_RECEIVED", { url: "/fr/compte/offres", body: "Renault Clio" });
  });

  it("ne touche ni au courriel ni au push quand ils ne sont pas demandés", async () => {
    await notifyUser({ userId: "u1", kind: "NEW_MESSAGE", url: "/fr/compte/messages/c1", body: "Clio" });

    expect(sendEmailBestEffort).not.toHaveBeenCalled();
    expect(sendPushToUser).not.toHaveBeenCalled();
    expect(createNotification).toHaveBeenCalledOnce();
  });

  it("transmet le titre in-app seulement quand il est fourni", async () => {
    await notifyUser({ userId: "u1", kind: "PRO_FOLLOWER_LISTING", url: "/fr/annonce/l1", body: "Clio", title: "Garage X" });
    expect(createNotification).toHaveBeenCalledWith("u1", "PRO_FOLLOWER_LISTING", { url: "/fr/annonce/l1", body: "Clio", title: "Garage X" });
  });

  it("enchaîne courriel → push → in-app dans cet ordre", async () => {
    const order: string[] = [];
    sendEmailBestEffort.mockImplementation(async () => { order.push("email"); return null; });
    sendPushToUser.mockImplementation(async () => { order.push("push"); return { sent: 0, removed: 0, failed: 0 }; });
    createNotification.mockImplementation(async () => { order.push("inapp"); });

    await notifyUser({
      userId: "u1",
      kind: "SEARCH_ALERT_MATCH",
      url: "/fr/annonce/l1",
      body: "Clio",
      email: { tag: "alerte recherche", to: "a@example.dz", subject: "s", html: "h" },
      push: { title: "t", body: "b" },
    });
    expect(order).toEqual(["email", "push", "inapp"]);
  });
});
