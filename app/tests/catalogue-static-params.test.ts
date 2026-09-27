import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    brand: { findMany: vi.fn() },
    model: { findMany: vi.fn() },
    blogArticle: { findMany: vi.fn() },
    wilaya: { findMany: vi.fn() },
  },
}));

// next-intl/server est importé par les pages mais n'a pas de rôle dans generateStaticParams.
vi.mock("next-intl/server", () => ({ getTranslations: vi.fn() }));
vi.mock("@/lib/blog-publication", () => ({
  publishedNow: () => ({ publishedAt: { lte: new Date() } }),
}));

import { prisma } from "@/lib/prisma";

// Imports dynamiques pour éviter que le module soit évalué avant les mocks.
async function importBrandPage() {
  return (await import("@/app/[locale]/voitures/[brand]/page")) as {
    generateStaticParams: () => Promise<{ locale: string; brand: string }[]>;
  };
}
async function importModelPage() {
  return (await import("@/app/[locale]/voitures/[brand]/[model]/page")) as {
    generateStaticParams: () => Promise<{ locale: string; brand: string; model: string }[]>;
  };
}
async function importMagPage() {
  return (await import("@/app/[locale]/mag/[slug]/page")) as {
    generateStaticParams: () => Promise<{ locale: string; slug: string }[]>;
  };
}
async function importEssaisPage() {
  return (await import("@/app/[locale]/essais/[slug]/page")) as {
    generateStaticParams: () => Promise<{ locale: string; slug: string }[]>;
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.resetModules();
});

// ---------------------------------------------------------------------------

describe("generateStaticParams — page marque (/voitures/[brand])", () => {
  it("retourne les deux locales pour chaque marque", async () => {
    vi.mocked(prisma.brand.findMany).mockResolvedValue([
      { slug: "renault" },
      { slug: "toyota" },
    ] as never);
    const { generateStaticParams } = await importBrandPage();
    const params = await generateStaticParams();
    expect(params).toEqual([
      { locale: "fr", brand: "renault" },
      { locale: "ar", brand: "renault" },
      { locale: "fr", brand: "toyota" },
      { locale: "ar", brand: "toyota" },
    ]);
  });

  it("retourne un tableau vide si aucune marque", async () => {
    vi.mocked(prisma.brand.findMany).mockResolvedValue([]);
    const { generateStaticParams } = await importBrandPage();
    expect(await generateStaticParams()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------

describe("generateStaticParams — page modèle (/voitures/[brand]/[model])", () => {
  it("retourne les deux locales pour chaque paire marque/modèle", async () => {
    vi.mocked(prisma.model.findMany).mockResolvedValue([
      { slug: "clio", brand: { slug: "renault" } },
      { slug: "yaris", brand: { slug: "toyota" } },
    ] as never);
    const { generateStaticParams } = await importModelPage();
    const params = await generateStaticParams();
    expect(params).toEqual([
      { locale: "fr", brand: "renault", model: "clio" },
      { locale: "ar", brand: "renault", model: "clio" },
      { locale: "fr", brand: "toyota", model: "yaris" },
      { locale: "ar", brand: "toyota", model: "yaris" },
    ]);
  });

  it("retourne un tableau vide si aucun modèle", async () => {
    vi.mocked(prisma.model.findMany).mockResolvedValue([]);
    const { generateStaticParams } = await importModelPage();
    expect(await generateStaticParams()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------

describe("generateStaticParams — page article mag (/mag/[slug])", () => {
  it("retourne les deux locales pour chaque article publié", async () => {
    vi.mocked(prisma.blogArticle.findMany).mockResolvedValue([
      { slug: "guide-achat-clio" },
      { slug: "les-meilleures-citadines" },
    ] as never);
    const { generateStaticParams } = await importMagPage();
    const params = await generateStaticParams();
    expect(params).toEqual([
      { locale: "fr", slug: "guide-achat-clio" },
      { locale: "ar", slug: "guide-achat-clio" },
      { locale: "fr", slug: "les-meilleures-citadines" },
      { locale: "ar", slug: "les-meilleures-citadines" },
    ]);
  });
});

// ---------------------------------------------------------------------------

describe("generateStaticParams — page essai (/essais/[slug])", () => {
  it("retourne les deux locales pour chaque essai publié", async () => {
    vi.mocked(prisma.blogArticle.findMany).mockResolvedValue([
      { slug: "essai-renault-clio-5" },
    ] as never);
    const { generateStaticParams } = await importEssaisPage();
    const params = await generateStaticParams();
    expect(params).toEqual([
      { locale: "fr", slug: "essai-renault-clio-5" },
      { locale: "ar", slug: "essai-renault-clio-5" },
    ]);
  });
});
