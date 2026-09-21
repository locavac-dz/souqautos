import { beforeEach, describe, expect, it, vi } from "vitest";

// Lot 145 — l'aperçu d'un contenu non publié (src/lib/article-preview.ts) : qui voit quoi. C'est une règle d'ACCÈS : chaque cas où
// quelqu'un d'autre qu'un administrateur pourrait voir un brouillon est verrouillé ici.

const getCurrentUser = vi.fn();
vi.mock("@/lib/auth-server/current-user", () => ({ getCurrentUser: () => getCurrentUser() }));

import { previewFor, resolveArticleForViewer } from "@/lib/article-preview";

const NOW = new Date("2026-09-21T12:00:00Z");
const PAST = new Date("2026-09-01T00:00:00Z");
const FUTURE = new Date("2026-10-15T09:30:00Z");

type Row = { id: string; publishedAt: Date | null };
const row = (publishedAt: Date | null): Row => ({ id: "a1", publishedAt });

beforeEach(() => {
  getCurrentUser.mockReset();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

describe("previewFor — décision pure", () => {
  it("un contenu PARU n'a jamais d'aperçu (il est public), quel que soit le visiteur", () => {
    expect(previewFor(PAST, NOW, true)).toBeNull();
    expect(previewFor(PAST, NOW, false)).toBeNull();
    expect(previewFor(NOW, NOW, true)).toBeNull(); // paru à la seconde près : public
  });

  it("un brouillon : aperçu pour un administrateur, RIEN pour tout autre visiteur", () => {
    expect(previewFor(null, NOW, true)).toEqual({ status: "draft", scheduledFor: null });
    expect(previewFor(null, NOW, false)).toBeNull();
  });

  it("un contenu programmé : aperçu avec sa date pour un administrateur, RIEN pour tout autre visiteur", () => {
    expect(previewFor(FUTURE, NOW, true)).toEqual({ status: "scheduled", scheduledFor: FUTURE });
    expect(previewFor(FUTURE, NOW, false)).toBeNull();
    expect(previewFor(new Date(NOW.getTime() + 1), NOW, true)?.status).toBe("scheduled"); // une milliseconde avant sa parution
  });
});

describe("resolveArticleForViewer — le chemin public n'est pas touché", () => {
  it("un contenu paru se sert SANS regarder qui est le visiteur : aucun appel d'authentification, aucune seconde lecture", async () => {
    const findAny = vi.fn();
    const result = await resolveArticleForViewer(async () => row(PAST), findAny);
    expect(result).toEqual({ article: row(PAST), preview: null });
    expect(getCurrentUser).not.toHaveBeenCalled();
    expect(findAny).not.toHaveBeenCalled();
  });

  it("un contenu qui n'existe pas répond « rien » sans regarder le visiteur", async () => {
    expect(await resolveArticleForViewer(async () => null, async () => null)).toBeNull();
    expect(getCurrentUser).not.toHaveBeenCalled();
  });
});

describe("resolveArticleForViewer — un contenu non paru", () => {
  const draft = () => resolveArticleForViewer(async () => null, async () => row(null));
  const scheduled = () => resolveArticleForViewer(async () => null, async () => row(FUTURE));

  it("un ADMINISTRATEUR voit le brouillon et le contenu programmé en aperçu", async () => {
    getCurrentUser.mockResolvedValue({ id: "u1", role: "ADMIN" });
    expect(await draft()).toEqual({ article: row(null), preview: { status: "draft", scheduledFor: null } });
    expect(await scheduled()).toEqual({ article: row(FUTURE), preview: { status: "scheduled", scheduledFor: FUTURE } });
  });

  it("personne d'autre : visiteur anonyme, particulier, professionnel, MODÉRATEUR — le même « rien » (404) que pour un contenu inexistant", async () => {
    for (const viewer of [null, { role: "PARTICULIER" }, { role: "PROFESSIONNEL" }, { role: "MODERATEUR" }]) {
      getCurrentUser.mockResolvedValue(viewer);
      expect(await draft(), JSON.stringify(viewer)).toBeNull();
      expect(await scheduled(), JSON.stringify(viewer)).toBeNull();
    }
  });

  it("le droit est celui d'ÉDITER (administrateur seulement) : un modérateur, qui ne peut pas modifier ces contenus, ne les voit pas non plus", async () => {
    getCurrentUser.mockResolvedValue({ role: "MODERATEUR" });
    expect(await draft()).toBeNull();
  });

  it("un contenu DÉJÀ paru mais masqué pour une autre raison (fiche manquante) n'est JAMAIS montré en aperçu, même à un administrateur", async () => {
    getCurrentUser.mockResolvedValue({ role: "ADMIN" });
    const result = await resolveArticleForViewer(async () => null, async () => row(PAST));
    expect(result).toBeNull();
    expect(getCurrentUser).not.toHaveBeenCalled(); // et sans même regarder le visiteur
  });

  it("ne regarde le visiteur qu'UNE fois, et seulement quand le contenu n'est pas paru", async () => {
    getCurrentUser.mockResolvedValue({ role: "ADMIN" });
    await draft();
    expect(getCurrentUser).toHaveBeenCalledTimes(1);
  });

  it("une erreur d'authentification n'ouvre JAMAIS l'aperçu : l'échec se propage, il ne devient pas un accès", async () => {
    getCurrentUser.mockRejectedValue(new Error("base indisponible"));
    await expect(draft()).rejects.toThrow("base indisponible");
  });
});
