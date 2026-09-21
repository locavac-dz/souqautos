import { beforeEach, describe, expect, it, vi } from "vitest";

// Lot 145 — l'aperçu d'un contenu non publié (src/lib/article-preview.ts) : qui voit quoi. C'est une règle d'ACCÈS : chaque cas où
// quelqu'un d'autre qu'un administrateur pourrait voir un brouillon est verrouillé ici.

const getCurrentUser = vi.fn();
vi.mock("@/lib/auth-server/current-user", () => ({ getCurrentUser: () => getCurrentUser() }));
// Lot 146 — la lecture d'un lien de relecture est simulée : ce fichier éprouve la RÈGLE d'accès, pas la base.
const findUsablePreviewLink = vi.fn();
vi.mock("@/lib/article-preview-links", () => ({ findUsablePreviewLink: (...args: unknown[]) => findUsablePreviewLink(...args) }));

import { previewFor, previewTokenFrom, resolveArticleForViewer } from "@/lib/article-preview";

const NOW = new Date("2026-09-21T12:00:00Z");
const PAST = new Date("2026-09-01T00:00:00Z");
const FUTURE = new Date("2026-10-15T09:30:00Z");

type Row = { id: string; publishedAt: Date | null };
const row = (publishedAt: Date | null): Row => ({ id: "a1", publishedAt });

beforeEach(() => {
  getCurrentUser.mockReset();
  findUsablePreviewLink.mockReset();
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

describe("previewTokenFrom — le jeton tel qu'il figure dans l'adresse", () => {
  it("garde la première valeur d'un paramètre répété, et ignore l'absent ou le vide", () => {
    expect(previewTokenFrom("abc")).toBe("abc");
    expect(previewTokenFrom(["premier", "second"])).toBe("premier");
    expect(previewTokenFrom(undefined)).toBeNull();
    expect(previewTokenFrom("")).toBeNull();
    expect(previewTokenFrom([])).toBeNull();
  });
});

describe("resolveArticleForViewer — lien de relecture (Lot 146)", () => {
  const LINK_EXPIRY = new Date("2026-09-28T12:00:00Z");
  const draft = (token: string | null) => resolveArticleForViewer(async () => null, async () => row(null), { previewToken: token });

  it("un lien VALIDE pour ce contenu ouvre l'aperçu SANS compte : lecture seule, avec l'échéance du lien", async () => {
    findUsablePreviewLink.mockResolvedValue({ id: "l1", expiresAt: LINK_EXPIRY });
    const result = await draft("jeton");
    expect(result).toEqual({ article: row(null), preview: { status: "draft", scheduledFor: null, reviewLink: { expiresAt: LINK_EXPIRY } } });
    expect(getCurrentUser).not.toHaveBeenCalled(); // aucun compte n'est nécessaire, ni même regardé
  });

  it("le jeton est vérifié POUR CE contenu précis (son identifiant), à l'instant présent", async () => {
    findUsablePreviewLink.mockResolvedValue({ id: "l1", expiresAt: LINK_EXPIRY });
    await draft("jeton");
    expect(findUsablePreviewLink).toHaveBeenCalledWith("jeton", "a1", NOW);
  });

  it("marche aussi pour un contenu programmé, avec sa date de parution", async () => {
    findUsablePreviewLink.mockResolvedValue({ id: "l1", expiresAt: LINK_EXPIRY });
    const result = await resolveArticleForViewer(async () => null, async () => row(FUTURE), { previewToken: "jeton" });
    expect(result?.preview).toEqual({ status: "scheduled", scheduledFor: FUTURE, reviewLink: { expiresAt: LINK_EXPIRY } });
  });

  it("un jeton INVALIDE (inconnu, autre contenu, révoqué, expiré) ne donne RIEN : même 404 qu'un visiteur anonyme", async () => {
    findUsablePreviewLink.mockResolvedValue(null);
    getCurrentUser.mockResolvedValue(null);
    expect(await draft("jeton")).toBeNull();
  });

  it("un jeton invalide ne retire rien à un administrateur : il retombe sur son droit d'administrateur, SANS marque de lien", async () => {
    findUsablePreviewLink.mockResolvedValue(null);
    getCurrentUser.mockResolvedValue({ role: "ADMIN" });
    const result = await draft("jeton");
    expect(result?.preview).toEqual({ status: "draft", scheduledFor: null });
    expect(result?.preview?.reviewLink).toBeUndefined();
  });

  it("un jeton invalide ne donne rien non plus à un modérateur ou à un membre", async () => {
    findUsablePreviewLink.mockResolvedValue(null);
    for (const role of ["MODERATEUR", "PARTICULIER"]) {
      getCurrentUser.mockResolvedValue({ role });
      expect(await draft("jeton"), role).toBeNull();
    }
  });

  it("le jeton n'est consulté QUE pour un contenu non paru : jamais sur le chemin public", async () => {
    const published = await resolveArticleForViewer(async () => row(PAST), async () => null, { previewToken: "jeton" });
    expect(published?.preview).toBeNull();
    expect(findUsablePreviewLink).not.toHaveBeenCalled();

    // Un contenu déjà paru mais masqué pour une autre raison : ni jeton, ni compte ne l'ouvrent.
    findUsablePreviewLink.mockResolvedValue({ id: "l1", expiresAt: LINK_EXPIRY });
    expect(await resolveArticleForViewer(async () => null, async () => row(PAST), { previewToken: "jeton" })).toBeNull();
    expect(findUsablePreviewLink).not.toHaveBeenCalled();
  });

  it("sans jeton, la lecture des liens n'est jamais sollicitée : le comportement du Lot 145 est inchangé", async () => {
    getCurrentUser.mockResolvedValue({ role: "ADMIN" });
    await draft(null);
    await resolveArticleForViewer(async () => null, async () => row(null));
    expect(findUsablePreviewLink).not.toHaveBeenCalled();
  });

  it("une erreur pendant la vérification du jeton n'ouvre JAMAIS l'aperçu : l'échec se propage", async () => {
    findUsablePreviewLink.mockRejectedValue(new Error("base indisponible"));
    await expect(draft("jeton")).rejects.toThrow("base indisponible");
  });
});
