// Tests unitaires du canal de notification externe (logique pure, sans base).
import { describe, it, expect, vi } from "vitest";
import {
  canalDepuisEnv,
  canalDesactive,
  CanalWebhook,
  dispatcherExterne,
  type CanalExterne,
  type Journal,
  type MessageExterne,
} from "@/lib/notifications/canal.js";

const MSG: MessageExterne = {
  organisationId: "org1",
  notificationId: "n1",
  destinataireUtilisateurId: "u1",
  type: "reclamation.statut",
  lien: "/reclamations/x",
};

function journalCapteur(): { journal: Journal; entrees: Record<string, unknown>[] } {
  const entrees: Record<string, unknown>[] = [];
  return { journal: { enregistrer: (e) => entrees.push(e) }, entrees };
}

describe("canalDepuisEnv", () => {
  it("désactivé par défaut", () => {
    expect(canalDepuisEnv({}).actif).toBe(false);
    expect(canalDepuisEnv({ NOTIF_CANAL: "webhook" }).actif).toBe(false); // sans URL
  });
  it("webhook actif si NOTIF_CANAL=webhook + URL", () => {
    const c = canalDepuisEnv({ NOTIF_CANAL: "webhook", NOTIF_WEBHOOK_URL: "https://relais.example/hook" });
    expect(c.actif).toBe(true);
    expect(c).toBeInstanceOf(CanalWebhook);
  });
});

describe("dispatcherExterne", () => {
  it("canal désactivé : ne journalise pas et renvoie 'desactive'", async () => {
    const { journal, entrees } = journalCapteur();
    expect(await dispatcherExterne(canalDesactive, journal, MSG)).toBe("desactive");
    expect(entrees).toHaveLength(0);
  });

  it("succès : journalise le statut SANS donnée sensible", async () => {
    const { journal, entrees } = journalCapteur();
    const canal: CanalExterne = { actif: true, envoyer: vi.fn(async () => "envoye" as const) };
    expect(await dispatcherExterne(canal, journal, MSG)).toBe("envoye");
    expect(entrees).toHaveLength(1);
    const e = entrees[0]!;
    expect(e.statut).toBe("envoye");
    expect(e.notificationId).toBe("n1");
    // Aucune donnée sensible (titre/corps/email) ne doit figurer.
    expect(JSON.stringify(e)).not.toMatch(/titre|corps|email|t[eé]l[eé]phone/i);
  });

  it("échec applicatif : journalise 'echec' sans lever", async () => {
    const { journal, entrees } = journalCapteur();
    const canal: CanalExterne = { actif: true, envoyer: vi.fn(async () => "echec" as const) };
    expect(await dispatcherExterne(canal, journal, MSG)).toBe("echec");
    expect(entrees[0]!.statut).toBe("echec");
  });

  it("exception du canal : avalée, journalise 'echec'", async () => {
    const { journal, entrees } = journalCapteur();
    const canal: CanalExterne = {
      actif: true,
      envoyer: vi.fn(async () => {
        throw new Error("réseau indisponible");
      }),
    };
    expect(await dispatcherExterne(canal, journal, MSG)).toBe("echec");
    expect(entrees[0]!.statut).toBe("echec");
  });
});

describe("CanalWebhook", () => {
  it("POST le payload minimal et renvoie 'envoye' si 2xx", async () => {
    const fetchFake: typeof fetch = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      new Response(null, { status: 204 }),
    ) as unknown as typeof fetch;
    const canal = new CanalWebhook("https://relais.example/hook", fetchFake);
    expect(await canal.envoyer(MSG)).toBe("envoye");
    const appels = (fetchFake as unknown as { mock: { calls: [RequestInfo | URL, RequestInit?][] } }).mock.calls;
    expect(appels).toHaveLength(1);
    const corps = JSON.parse(appels[0]![1]!.body as string) as Record<string, unknown>;
    expect(corps.notificationId).toBe("n1");
    expect(corps).not.toHaveProperty("titre");
    expect(corps).not.toHaveProperty("corps");
  });

  it("renvoie 'echec' si réponse non-2xx", async () => {
    const fetchFake: typeof fetch = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      new Response("err", { status: 500 }),
    ) as unknown as typeof fetch;
    const canal = new CanalWebhook("https://relais.example/hook", fetchFake);
    expect(await canal.envoyer(MSG)).toBe("echec");
  });
});
