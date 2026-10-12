import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Une annonce inexistante ou non publique d'un autre vendeur doit répondre un vrai 404, avant le flux de la page
// (cf. src/app/[locale]/annonce/[id]/layout.tsx : `loading.tsx` ferait sinon partir un 200).
const findUnique = vi.fn();
const getCurrentUser = vi.fn();
const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});

vi.mock("@/lib/prisma", () => ({ prisma: { listing: { findUnique: (...a: unknown[]) => findUnique(...a) } } }));
vi.mock("@/lib/auth-server/current-user", () => ({ getCurrentUser: () => getCurrentUser() }));
vi.mock("next/navigation", () => ({ notFound: () => notFound() }));

import AnnonceLayout from "@/app/[locale]/annonce/[id]/layout";

const render = (id = "abc") => AnnonceLayout({ children: createElement("main"), params: Promise.resolve({ id }) });

beforeEach(() => {
  findUnique.mockReset();
  getCurrentUser.mockReset().mockResolvedValue(null);
  notFound.mockClear();
});

describe("layout de la fiche annonce — 404 avant le flux", () => {
  it("répond 404 pour une annonce inexistante", async () => {
    findUnique.mockResolvedValue(null);
    await expect(render()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(findUnique).toHaveBeenCalledWith({ where: { id: "abc" }, select: { status: true, sellerId: true } });
  });

  it("répond 404 pour une annonce en attente quand le visiteur est anonyme ou un autre membre", async () => {
    findUnique.mockResolvedValue({ status: "EN_ATTENTE", sellerId: "vendeur" });
    await expect(render()).rejects.toThrow("NEXT_NOT_FOUND");

    getCurrentUser.mockResolvedValue({ id: "autre" });
    await expect(render()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledTimes(2);
  });

  it("laisse passer une annonce publiée, même pour un anonyme", async () => {
    findUnique.mockResolvedValue({ status: "PUBLIEE", sellerId: "vendeur" });
    await expect(render()).resolves.toBeTruthy();
    expect(notFound).not.toHaveBeenCalled();
  });

  it("laisse passer son auteur pour une annonce non publiée", async () => {
    findUnique.mockResolvedValue({ status: "EN_ATTENTE", sellerId: "vendeur" });
    getCurrentUser.mockResolvedValue({ id: "vendeur" });
    await expect(render()).resolves.toBeTruthy();
    expect(notFound).not.toHaveBeenCalled();
  });
});
