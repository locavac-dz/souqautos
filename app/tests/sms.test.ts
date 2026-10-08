import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

import { sendSms } from "@/lib/sms";

const ARGS = { to: "+213555000001", message: "Code OTP : 123456" };

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("TWILIO_ACCOUNT_SID", "AC_test");
  vi.stubEnv("TWILIO_AUTH_TOKEN", "token_test");
  vi.stubEnv("TWILIO_FROM_NUMBER", "+12015551234");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("sendSms — mode développement", () => {
  it("ne fait aucun appel réseau en mode dev", async () => {
    vi.stubEnv("NODE_ENV", "test"); // vitest tourne en "test", pas "production"
    await sendSms(ARGS);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("sendSms — mode production", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
  });

  it("envoie une requête POST à l'API Twilio et répond true", async () => {
    fetchMock.mockResolvedValue({ ok: true });
    await expect(sendSms(ARGS)).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("AC_test");
    expect(opts.method).toBe("POST");
    expect((opts.headers as Record<string, string>)["Authorization"]).toMatch(/^Basic /);
  });

  it("inclut les champs From, To, Body dans le body encodé", async () => {
    fetchMock.mockResolvedValue({ ok: true });
    await sendSms(ARGS);
    const rawBody = String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body);
    // URLSearchParams encode les espaces en "+" et certains caractères en %XX
    // On décode pour vérifier le contenu réel
    const decoded = new URLSearchParams(rawBody);
    expect(decoded.get("From")).toBe("+12015551234");
    expect(decoded.get("To")).toBe(ARGS.to);
    expect(decoded.get("Body")).toBe(ARGS.message);
  });

  // Lot 265 — `false` (et non une exception, ni un faux succès) quand le message n'est pas parti ; le journal
  // ne contient ni le code ni le numéro complet.
  it("répond false et logue une erreur sans le numéro complet si Twilio répond en erreur", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 400, text: async () => "invalid number" });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(sendSms(ARGS)).resolves.toBe(false);
    expect(spy).toHaveBeenCalled();
    const logged = String(spy.mock.calls[0][0]);
    expect(logged).not.toContain(ARGS.to);
    expect(logged).not.toContain("123456");
    spy.mockRestore();
  });

  it("répond false sans appel réseau si les variables Twilio manquent", async () => {
    vi.stubEnv("TWILIO_ACCOUNT_SID", "");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(sendSms(ARGS)).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("répond false si Twilio est injoignable (exception réseau), sans propager", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNRESET"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(sendSms(ARGS)).resolves.toBe(false);
    spy.mockRestore();
  });
});
