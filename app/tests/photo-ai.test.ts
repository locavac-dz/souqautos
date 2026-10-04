import { describe, expect, it, vi, beforeEach } from "vitest";

// callAnthropicVision est simulé — aucun appel réseau réel dans ces tests.
const { callAnthropicVision } = vi.hoisted(() => ({ callAnthropicVision: vi.fn() }));
vi.mock("@/lib/anthropic-client", () => ({ callAnthropicVision }));

// sharp est simulé — le redimensionnement retourne directement le buffer d'entrée.
vi.mock("sharp", () => {
  const chainable = (buf: Buffer) => ({
    resize: () => chainable(buf),
    jpeg: () => chainable(buf),
    toBuffer: () => Promise.resolve(buf),
  });
  return { default: chainable };
});

import { analyzePhoto } from "@/lib/photo-ai";

const FAKE_BUFFER = Buffer.from("fake-jpeg");

beforeEach(() => {
  vi.clearAllMocks();
  // La clé API est présente par défaut dans les tests — les cas "clé absente"
  // sont testés explicitement en supprimant la variable.
  process.env.ANTHROPIC_API_KEY = "test-key";
});

describe("analyzePhoto — comportement avec l'API", () => {
  it("retourne null sans clé API (ANTHROPIC_API_KEY absent)", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const result = await analyzePhoto(FAKE_BUFFER);
    expect(result).toBeNull();
    expect(callAnthropicVision).not.toHaveBeenCalled();
  });

  it("parse correctement un JSON valide renvoyé par l'API", async () => {
    callAnthropicVision.mockResolvedValue(
      '{"subject":"exterior","hasWatermark":false,"isProfessionalStock":false,"note":null}'
    );
    const result = await analyzePhoto(FAKE_BUFFER);
    expect(result).toEqual({
      subject: "exterior",
      hasWatermark: false,
      isProfessionalStock: false,
      note: null,
    });
  });

  it("détecte correctement un filigrane", async () => {
    callAnthropicVision.mockResolvedValue(
      '{"subject":"exterior","hasWatermark":true,"isProfessionalStock":false,"note":"Logo autoscout24 visible"}'
    );
    const result = await analyzePhoto(FAKE_BUFFER);
    expect(result?.hasWatermark).toBe(true);
    expect(result?.note).toBe("Logo autoscout24 visible");
  });

  it("détecte correctement une photo catalogue", async () => {
    callAnthropicVision.mockResolvedValue(
      '{"subject":"exterior","hasWatermark":false,"isProfessionalStock":true,"note":null}'
    );
    const result = await analyzePhoto(FAKE_BUFFER);
    expect(result?.isProfessionalStock).toBe(true);
  });

  it("retourne null si l'API renvoie null (clé invalide, quota, etc.)", async () => {
    callAnthropicVision.mockResolvedValue(null);
    const result = await analyzePhoto(FAKE_BUFFER);
    expect(result).toBeNull();
  });

  it("retourne null si l'API renvoie du JSON invalide — jamais une exception", async () => {
    callAnthropicVision.mockResolvedValue("ce n'est pas du JSON");
    const result = await analyzePhoto(FAKE_BUFFER);
    expect(result).toBeNull();
  });

  it("remplace un subject inconnu par 'other' — tolérance au format", async () => {
    callAnthropicVision.mockResolvedValue(
      '{"subject":"dashboard","hasWatermark":false,"isProfessionalStock":false,"note":null}'
    );
    const result = await analyzePhoto(FAKE_BUFFER);
    expect(result?.subject).toBe("other");
  });

  it("tronque une note trop longue à 200 caractères", async () => {
    const longNote = "a".repeat(300);
    callAnthropicVision.mockResolvedValue(
      `{"subject":"other","hasWatermark":false,"isProfessionalStock":false,"note":"${longNote}"}`
    );
    const result = await analyzePhoto(FAKE_BUFFER);
    expect(result?.note?.length).toBe(200);
  });

  it("ignore une note non-string (null dans le JSON) — retourne null pour note", async () => {
    callAnthropicVision.mockResolvedValue(
      '{"subject":"interior","hasWatermark":false,"isProfessionalStock":false,"note":42}'
    );
    const result = await analyzePhoto(FAKE_BUFFER);
    expect(result?.note).toBeNull();
  });
});
