import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const getCurrentUser = vi.fn();
const checkRateLimit = vi.fn();
const improveListingText = vi.fn();

vi.mock("@/lib/auth-server/current-user", () => ({ getCurrentUser: () => getCurrentUser() }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...a: unknown[]) => checkRateLimit(...a),
}));
vi.mock("@/lib/ai-listing", () => ({
  improveListingText: (...a: unknown[]) => improveListingText(...a),
}));

import { POST } from "@/app/api/listings/improve/route";

const VALID_BODY = {
  title: "Renault Clio 2019 diesel",
  description: "Très bon état général, premier propriétaire, entretien suivi.",
  brand: "Renault",
  model: "Clio",
  year: 2019,
  mileage: 85_000,
  condition: "OCCASION",
};

function request(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ANTHROPIC_API_KEY = "test-key";
  getCurrentUser.mockResolvedValue({ id: "user-1", role: "USER" });
  checkRateLimit.mockResolvedValue(true);
  improveListingText.mockResolvedValue({ title: "Renault Clio 2019 diesel — état impeccable", description: "Premier propriétaire, entretien rigoureux chez concessionnaire." });
});

describe("POST /api/listings/improve", () => {
  it("retourne 401 si non authentifié", async () => {
    getCurrentUser.mockResolvedValue(null);
    const res = await POST(request(VALID_BODY));
    expect(res.status).toBe(401);
  });

  it("retourne 429 si le rate limit est dépassé", async () => {
    checkRateLimit.mockResolvedValue(false);
    const res = await POST(request(VALID_BODY));
    expect(res.status).toBe(429);
  });

  it("retourne 400 si le titre est trop court (< 3 car.)", async () => {
    const res = await POST(request({ ...VALID_BODY, title: "AB" }));
    expect(res.status).toBe(400);
  });

  it("retourne 400 si la description est trop courte (< 10 car.)", async () => {
    const res = await POST(request({ ...VALID_BODY, description: "Court" }));
    expect(res.status).toBe(400);
  });

  it("retourne 503 si ANTHROPIC_API_KEY est absent", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const res = await POST(request(VALID_BODY));
    expect(res.status).toBe(503);
  });

  it("retourne 503 si improveListingText retourne null", async () => {
    improveListingText.mockResolvedValue(null);
    const res = await POST(request(VALID_BODY));
    expect(res.status).toBe(503);
  });

  it("retourne 200 avec le texte amélioré", async () => {
    const res = await POST(request(VALID_BODY));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      title: "Renault Clio 2019 diesel — état impeccable",
      description: "Premier propriétaire, entretien rigoureux chez concessionnaire.",
    });
  });
});
