// Lot 273 — POST /api/contact : enregistrement, routage, Reply-To, accusé de réception.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const { checkRateLimit, contactCreate, contactUpdate, sendEmail, sendEmailBestEffort, afterCallbacks } = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  contactCreate: vi.fn(),
  contactUpdate: vi.fn(),
  sendEmail: vi.fn(),
  sendEmailBestEffort: vi.fn(),
  afterCallbacks: [] as Array<() => Promise<void> | void>,
}));

vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: (...a: unknown[]) => checkRateLimit(...a) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    contactMessage: {
      create: (...a: unknown[]) => contactCreate(...a),
      update: (...a: unknown[]) => contactUpdate(...a),
    },
  },
}));
vi.mock("@/lib/mailer", () => ({
  sendEmail: (...a: unknown[]) => sendEmail(...a),
  sendEmailBestEffort: (...a: unknown[]) => sendEmailBestEffort(...a),
  escapeHtml: (s: string) => s.replace(/</g, "&lt;").replace(/>/g, "&gt;"),
}));
vi.mock("@/lib/site", () => ({ SITE_URL: "https://souqauto.example" }));
vi.mock("@/lib/prisma-errors", () => ({ isUniqueViolation: (e: unknown) => (e as { code?: string })?.code === "P2002" }));
vi.mock("next-intl/server", () => ({ getTranslations: async () => (key: string) => key }));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (fn: () => Promise<void> | void) => void afterCallbacks.push(fn),
}));

import { POST } from "@/app/api/contact/route";

function request(body: unknown): NextRequest {
  return { json: async () => body, headers: { get: () => null } } as unknown as NextRequest;
}

const VALID = {
  name: "Karim Boudiaf",
  email: "karim@example.dz",
  subject: "technical",
  message: "Impossible d'envoyer mes photos depuis mon téléphone, le bouton reste gris.",
  honeypot: "",
  locale: "ar",
};

beforeEach(() => {
  vi.clearAllMocks();
  afterCallbacks.length = 0;
  checkRateLimit.mockResolvedValue(true);
  contactCreate.mockImplementation(async ({ data }: { data: { reference: string } }) => ({ id: "cm1", reference: data.reference }));
  contactUpdate.mockResolvedValue({});
  sendEmail.mockResolvedValue({});
  sendEmailBestEffort.mockResolvedValue({});
  vi.stubEnv("ADMIN_EMAIL", "pdg@souqauto.dz");
  vi.stubEnv("STAFF_ALERT_EMAILS", "equipe@souqauto.dz");
});

describe("POST /api/contact", () => {
  it("enregistre le message avec une référence, l'envoie à l'équipe en Reply-To client, répond 201 avec la référence", async () => {
    const res = await POST(request(VALID));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.reference).toMatch(/^SA-[A-Z2-9]{6}$/);

    const created = contactCreate.mock.calls[0][0].data;
    expect(created).toMatchObject({ name: "Karim Boudiaf", email: "karim@example.dz", subject: "TECHNICAL", locale: "ar", routedTo: "equipe@souqauto.dz" });

    expect(sendEmail).toHaveBeenCalledOnce();
    const team = sendEmail.mock.calls[0][0];
    expect(team.to).toBe("equipe@souqauto.dz");
    expect(team.replyTo).toBe("karim@example.dz");
    expect(team.subject).toContain(json.reference);
  });

  it("route les demandes pro et partenariat vers le PDG", async () => {
    await POST(request({ ...VALID, subject: "pro" }));
    expect(sendEmail.mock.calls[0][0].to).toBe("pdg@souqauto.dz");
    expect(contactCreate.mock.calls[0][0].data.routedTo).toBe("pdg@souqauto.dz");
  });

  it("envoie l'accusé de réception au client après la réponse et note l'envoi", async () => {
    const res = await POST(request(VALID));
    const { reference } = await res.json();
    expect(sendEmailBestEffort).not.toHaveBeenCalled();

    for (const cb of afterCallbacks) await cb();
    expect(sendEmailBestEffort).toHaveBeenCalledOnce();
    const [tag, args] = sendEmailBestEffort.mock.calls[0];
    expect(tag).toContain(reference);
    expect(args.to).toBe("karim@example.dz");
    expect(args.subject).toBe("ackSubject");
    expect(contactUpdate).toHaveBeenCalledWith({ where: { id: "cm1" }, data: { ackSentAt: expect.any(Date) } });
  });

  it("n'inscrit pas l'accusé comme envoyé quand le courriel échoue", async () => {
    sendEmailBestEffort.mockResolvedValue(null);
    await POST(request(VALID));
    for (const cb of afterCallbacks) await cb();
    expect(contactUpdate).not.toHaveBeenCalled();
  });

  it("garde le message dans la file même si le courriel à l'équipe échoue", async () => {
    sendEmail.mockRejectedValue(new Error("SMTP down"));
    const res = await POST(request(VALID));
    expect(res.status).toBe(201);
    expect(contactCreate).toHaveBeenCalledOnce();
  });

  it("retire une référence déjà prise", async () => {
    contactCreate
      .mockRejectedValueOnce(Object.assign(new Error("unique"), { code: "P2002" }))
      .mockImplementationOnce(async ({ data }: { data: { reference: string } }) => ({ id: "cm2", reference: data.reference }));
    const res = await POST(request(VALID));
    expect(res.status).toBe(201);
    expect(contactCreate).toHaveBeenCalledTimes(2);
  });

  it("répond 503 sans aucun destinataire en production, sans rien enregistrer", async () => {
    vi.stubEnv("ADMIN_EMAIL", "");
    vi.stubEnv("STAFF_ALERT_EMAILS", "");
    vi.stubEnv("NODE_ENV", "production");
    const res = await POST(request(VALID));
    expect(res.status).toBe(503);
    expect(contactCreate).not.toHaveBeenCalled();
  });

  it("répond 400 avec les issues sur un corps invalide, 429 au-delà de la limite", async () => {
    const bad = await POST(request({ ...VALID, email: "pas-un-email" }));
    expect(bad.status).toBe(400);
    expect((await bad.json()).issues[0].path).toEqual(["email"]);

    checkRateLimit.mockResolvedValue(false);
    expect((await POST(request(VALID))).status).toBe(429);
  });
});
