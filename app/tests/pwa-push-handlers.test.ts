import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

// Lot 121 — les gestionnaires `push` et `notificationclick` du VRAI fichier public/sw.js, exécutés
// dans un contexte isolé avec un faux `self` : on vérifie ce que le service worker affiche à la
// réception d'un message, et ce qu'il ouvre au clic. (Le navigateur sans interface de cet
// environnement refuse toute permission de notification : un test Playwright y serait vide.)
const SOURCE = readFileSync(path.resolve(__dirname, "../public/sw.js"), "utf8");
const ORIGIN = "https://souqauto.example";

type Handler = (event: unknown) => void;
const handlers = new Map<string, Handler>();
const showNotification = vi.fn();
const matchAll = vi.fn();
const openWindow = vi.fn();

function loadWorker() {
  handlers.clear();
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, fn: Handler) => handlers.set(type, fn),
    registration: { showNotification },
    clients: { matchAll, openWindow, claim: vi.fn() },
    skipWaiting: vi.fn(),
  };
  vm.runInNewContext(SOURCE, { self, URL, Promise, JSON, String, Response, caches: {} });
}

// Livre un message push et rend les arguments passés à showNotification.
async function receivePush(text: string | null) {
  let pending: Promise<unknown> | undefined;
  handlers.get("push")!({ data: text === null ? null : { text: () => text }, waitUntil: (p: Promise<unknown>) => (pending = p) });
  await pending;
  return showNotification.mock.calls.at(-1) as [string, Record<string, unknown>];
}

async function click(notificationData: unknown) {
  const close = vi.fn();
  let pending: Promise<unknown> | undefined;
  handlers.get("notificationclick")!({ notification: { close, data: notificationData }, waitUntil: (p: Promise<unknown>) => (pending = p) });
  await pending;
  return { close };
}

beforeEach(() => {
  vi.resetAllMocks();
  showNotification.mockResolvedValue(undefined);
  openWindow.mockResolvedValue(null);
  loadWorker();
});

describe("service worker — réception d'un message push", () => {
  it("shows the notification with the received content, the site icon and the page to open", async () => {
    const [title, options] = await receivePush(JSON.stringify({ title: "Nouvelle annonce", body: "Clio 4 — 1 850 000 DA", url: "/fr/annonce/abc", tag: "alert-1-abc", lang: "fr" }));
    expect(title).toBe("Nouvelle annonce");
    expect(options).toEqual({ body: "Clio 4 — 1 850 000 DA", icon: "/icons/icon-192.png", tag: "alert-1-abc", lang: "fr", dir: "ltr", data: { url: "/fr/annonce/abc" } });
  });

  it("shows an Arabic notification right-to-left", async () => {
    const [title, options] = await receivePush(JSON.stringify({ title: "إعلان جديد", lang: "ar", url: "/ar/annonce/abc" }));
    expect(title).toBe("إعلان جديد");
    expect(options).toMatchObject({ lang: "ar", dir: "rtl", data: { url: "/ar/annonce/abc" } });
  });

  it("stores only a page of the site as the address to open, whatever the message says", async () => {
    for (const url of ["https://evil.example/phishing", "//evil.example", "javascript:alert(1)"]) {
      const [, options] = await receivePush(JSON.stringify({ title: "x", url }));
      expect(options.data, url).toEqual({ url: "/" });
    }
  });

  it("never shows an empty notification: no body at all, or one that is not JSON", async () => {
    expect((await receivePush(null))[0]).toBe("Souq Auto");
    expect((await receivePush("ceci n'est pas du JSON"))[0]).toBe("Souq Auto");
  });

  it("keeps the browser waiting until the notification is really shown (or it may kill the worker)", async () => {
    let resolve!: () => void;
    showNotification.mockReturnValue(new Promise<void>((r) => (resolve = r)));
    let pending: Promise<unknown> | undefined;
    handlers.get("push")!({ data: { text: () => "{}" }, waitUntil: (p: Promise<unknown>) => (pending = p) });
    let done = false;
    void pending!.then(() => (done = true));
    await Promise.resolve();
    expect(done).toBe(false);
    resolve();
    await pending;
    expect(done).toBe(true);
  });
});

describe("service worker — clic sur une notification", () => {
  it("closes the notification and reuses an open tab of the site, navigating it to the page", async () => {
    const navigate = vi.fn().mockResolvedValue(null);
    const focus = vi.fn().mockResolvedValue({ navigate });
    matchAll.mockResolvedValue([{ url: `${ORIGIN}/fr/recherche`, focus }]);
    const { close } = await click({ url: "/fr/annonce/abc" });
    expect(close).toHaveBeenCalled();
    expect(matchAll).toHaveBeenCalledWith({ type: "window", includeUncontrolled: true });
    expect(focus).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith("/fr/annonce/abc");
    expect(openWindow).not.toHaveBeenCalled();
  });

  it("opens a new window when no tab of the site is open", async () => {
    matchAll.mockResolvedValue([]);
    await click({ url: "/fr/annonce/abc" });
    expect(openWindow).toHaveBeenCalledWith("/fr/annonce/abc");
  });

  it("ignores tabs of other sites", async () => {
    const focus = vi.fn();
    matchAll.mockResolvedValue([{ url: "https://autre-site.example/page", focus }]);
    await click({ url: "/fr" });
    expect(focus).not.toHaveBeenCalled();
    expect(openWindow).toHaveBeenCalledWith("/fr");
  });

  it("opens a window when the browser cannot navigate the focused tab (iOS, older browsers)", async () => {
    matchAll.mockResolvedValue([{ url: `${ORIGIN}/fr`, focus: vi.fn().mockResolvedValue({}) }]);
    await click({ url: "/fr/annonce/abc" });
    expect(openWindow).toHaveBeenCalledWith("/fr/annonce/abc");
  });

  it("falls back to the home page for missing or foreign data, even if the notification was tampered with", async () => {
    matchAll.mockResolvedValue([]);
    await click(undefined);
    expect(openWindow).toHaveBeenLastCalledWith("/");
    await click({ url: "https://evil.example/x" });
    expect(openWindow).toHaveBeenLastCalledWith("/");
    await click({ url: 42 });
    expect(openWindow).toHaveBeenLastCalledWith("/");
  });
});
