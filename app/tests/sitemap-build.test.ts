import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// La compilation de production (image Docker, CI) n'a aucune base de données : le plan du site doit alors se limiter aux
// pages statiques au lieu de faire échouer toute la compilation. En service, une base indisponible reste une erreur.

const prisma = vi.hoisted(() => ({
  brand: { findMany: vi.fn() },
  wilaya: { findMany: vi.fn() },
  blogArticle: { findMany: vi.fn() },
  listing: { count: vi.fn(), findMany: vi.fn() },
}));
const getDirectoryEntries = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/professional-directory", () => ({ getDirectoryEntries }));

import sitemap from "@/app/sitemap";

const STATIC_COUNT = 15;
const indisponible = new Error("Environment variable not found: DATABASE_URL.");

function baseDisponible() {
  prisma.brand.findMany.mockResolvedValue([{ slug: "toyota", models: [{ slug: "yaris" }, { slug: "corolla" }] }]);
  prisma.wilaya.findMany.mockResolvedValue([{ slug: "alger" }]);
  prisma.blogArticle.findMany.mockResolvedValue([{ slug: "guide", kind: "GUIDE", updatedAt: new Date("2026-10-01") }]);
  getDirectoryEntries.mockResolvedValue([{ id: "pro-1" }]);
  prisma.listing.count.mockResolvedValue(1);
  prisma.listing.findMany.mockResolvedValue([{ id: "annonce-1", createdAt: new Date("2026-10-02") }]);
}

function baseAbsente() {
  prisma.brand.findMany.mockRejectedValue(indisponible);
  prisma.wilaya.findMany.mockRejectedValue(indisponible);
  prisma.blogArticle.findMany.mockRejectedValue(indisponible);
  getDirectoryEntries.mockRejectedValue(indisponible);
  prisma.listing.count.mockRejectedValue(indisponible);
  prisma.listing.findMany.mockRejectedValue(indisponible);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("plan du site — base indisponible", () => {
  it("pendant la compilation de production : pages statiques seules, sans erreur", async () => {
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    baseAbsente();

    const entries = await sitemap();

    expect(entries).toHaveLength(STATIC_COUNT);
    expect(entries.every((entry) => !entry.url.includes("/annonce/") && !entry.url.includes("/pro/"))).toBe(true);
    expect(entries.some((entry) => entry.url.endsWith("/fr/recherche"))).toBe(true);
    expect(console.warn).toHaveBeenCalled();
  });

  it("en service : l'erreur est propagée, pour que Next.js garde le dernier plan complet", async () => {
    vi.stubEnv("NEXT_PHASE", "phase-production-server");
    baseAbsente();

    await expect(sitemap()).rejects.toThrow("DATABASE_URL");
  });

  it("sans phase connue (développement, tests) : l'erreur est propagée", async () => {
    baseAbsente();

    await expect(sitemap()).rejects.toThrow("DATABASE_URL");
  });
});

describe("plan du site — base disponible", () => {
  it("ajoute les pages issues de la base après les pages statiques, y compris pendant la compilation", async () => {
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    baseDisponible();

    const urls = (await sitemap()).map((entry) => entry.url);

    // 15 statiques + 1 vitrine + 1 marque + 2 modèles + 1 wilaya + 1 annonce + 1 article
    expect(urls).toHaveLength(STATIC_COUNT + 7);
    expect(urls.slice(0, STATIC_COUNT).some((url) => url.includes("/annonce/"))).toBe(false);
    expect(urls.some((url) => url.endsWith("/pro/pro-1"))).toBe(true);
    expect(urls.some((url) => url.endsWith("/voitures/toyota/yaris"))).toBe(true);
    expect(urls.some((url) => url.endsWith("/annonce/annonce-1"))).toBe(true);
  });
});
