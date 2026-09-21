import { beforeEach, describe, expect, it, vi } from "vitest";

// Lot 146 — les liens de relecture d'un contenu non publié (src/lib/article-preview-links.ts). Un lien est un SECRET qui donne accès à un
// contenu non publié : chaque propriété de sécurité (jeton jamais stocké, lié à un contenu, expiration, révocation, plafond) est verrouillée.

process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64"); // clé de test : l'empreinte du jeton en dépend

const db = {
  count: vi.fn(),
  create: vi.fn(),
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
  findMany: vi.fn(),
};
vi.mock("@/lib/prisma", () => ({ prisma: { articlePreviewLink: { count: (a: unknown) => db.count(a), create: (a: unknown) => db.create(a), findUnique: (a: unknown) => db.findUnique(a), findFirst: (a: unknown) => db.findFirst(a), update: (a: unknown) => db.update(a), findMany: (a: unknown) => db.findMany(a) } } }));

import { keyedHash } from "@/lib/crypto/at-rest";
import {
  DEFAULT_PREVIEW_LINK_DAYS,
  MAX_ACTIVE_PREVIEW_LINKS,
  PREVIEW_LINK_DURATIONS_DAYS,
  TooManyPreviewLinksError,
  createPreviewLink,
  findUsablePreviewLink,
  generatePreviewToken,
  hashPreviewToken,
  isPlausiblePreviewToken,
  parsePreviewDays,
  previewLinkExpiry,
  previewLinkState,
  revokePreviewLink,
} from "@/lib/article-preview-links";

const NOW = new Date("2026-09-21T12:00:00Z");
const MIN = 60_000;
const DAY = 86_400_000;

beforeEach(() => {
  for (const fn of Object.values(db)) fn.mockReset();
  db.update.mockResolvedValue({});
});

describe("le jeton", () => {
  it("est aléatoire, de 43 caractères sûrs pour une adresse, et n'a jamais de doublon", () => {
    const tokens = new Set(Array.from({ length: 2000 }, () => generatePreviewToken()));
    expect(tokens.size).toBe(2000);
    for (const token of tokens) {
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(isPlausiblePreviewToken(token)).toBe(true);
    }
  });

  it("n'est reconnu plausible qu'à sa forme exacte : rien d'absurde, de trop court, de trop long ou de non textuel n'atteint la base", () => {
    const valid = generatePreviewToken();
    expect(isPlausiblePreviewToken(valid)).toBe(true);
    for (const bad of [undefined, null, 0, 42, {}, [], [valid], "", "abc", valid.slice(1), valid + "a", `${valid.slice(0, 42)}=`, `${valid.slice(0, 42)}/`, `${valid.slice(0, 42)} `, "a".repeat(10_000), valid.replace(/./, "é")]) {
      expect(isPlausiblePreviewToken(bad), String(bad).slice(0, 20)).toBe(false);
    }
  });
});

describe("l'empreinte", () => {
  it("est déterministe, propre à chaque jeton, et ne contient jamais le jeton", () => {
    const a = generatePreviewToken();
    const b = generatePreviewToken();
    expect(hashPreviewToken(a)).toBe(hashPreviewToken(a));
    expect(hashPreviewToken(a)).not.toBe(hashPreviewToken(b));
    expect(hashPreviewToken(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashPreviewToken(a)).not.toContain(a);
  });

  it("dépend de la clé du serveur et de sa finalité : une copie de la base ne suffit pas à la recalculer", () => {
    const token = generatePreviewToken();
    expect(hashPreviewToken(token)).toBe(keyedHash("article-preview-link", token));
    expect(hashPreviewToken(token)).not.toBe(keyedHash("autre-finalite", token)); // pas la même empreinte qu'une autre fonction du site
  });
});

describe("les durées", () => {
  it("n'acceptent que celles de la liste : jamais un nombre de jours libre venu du navigateur", () => {
    for (const days of PREVIEW_LINK_DURATIONS_DAYS) expect(parsePreviewDays(days)).toBe(days);
    expect(PREVIEW_LINK_DURATIONS_DAYS as readonly number[]).toContain(DEFAULT_PREVIEW_LINK_DAYS);
    for (const bad of [0, 2, 31, 365, 3650, -7, 7.5, NaN, Infinity, "7", null, undefined, {}, [7]]) expect(parsePreviewDays(bad), String(bad)).toBeNull();
  });

  it("l'échéance est exactement maintenant + N jours", () => {
    expect(previewLinkExpiry(NOW, 7).getTime()).toBe(NOW.getTime() + 7 * DAY);
    expect(previewLinkExpiry(NOW, 1).getTime()).toBe(NOW.getTime() + DAY);
  });
});

describe("l'état d'un lien", () => {
  const link = (expiresIn: number, revoked = false) => ({ expiresAt: new Date(NOW.getTime() + expiresIn), revokedAt: revoked ? new Date(NOW.getTime() - MIN) : null });

  it("actif jusqu'à la milliseconde qui précède son échéance, expiré à l'échéance exacte", () => {
    expect(previewLinkState(link(DAY), NOW)).toBe("active");
    expect(previewLinkState(link(1), NOW)).toBe("active"); // une milliseconde avant
    expect(previewLinkState(link(0), NOW)).toBe("expired"); // à l'échéance exacte : plus valable
    expect(previewLinkState(link(-1), NOW)).toBe("expired");
  });

  it("un lien révoqué ne sert plus, même avant son échéance, et « révoqué » l'emporte sur « expiré »", () => {
    expect(previewLinkState(link(DAY, true), NOW)).toBe("revoked");
    expect(previewLinkState(link(-DAY, true), NOW)).toBe("revoked");
  });
});

describe("createPreviewLink", () => {
  it("ne stocke JAMAIS le jeton : seule son empreinte est écrite, et le jeton n'est rendu qu'à la création", async () => {
    db.count.mockResolvedValue(0);
    db.create.mockImplementation(async (args: { data: { expiresAt: Date } }) => ({ id: "l1", createdAt: NOW, expiresAt: args.data.expiresAt }));
    const { token, link } = await createPreviewLink({ articleId: "a1", adminId: "u1", days: 7, now: NOW });

    expect(isPlausiblePreviewToken(token)).toBe(true);
    const written = db.create.mock.calls[0][0].data;
    expect(written.tokenHash).toBe(hashPreviewToken(token));
    expect(JSON.stringify(db.create.mock.calls[0][0])).not.toContain(token); // le jeton n'apparaît nulle part dans ce qui est écrit
    expect(written).toMatchObject({ articleId: "a1", createdById: "u1" });
    expect(written.expiresAt.getTime()).toBe(NOW.getTime() + 7 * DAY);
    expect(link.id).toBe("l1");
  });

  it("refuse au-delà du plafond de liens ACTIFS, sans rien créer ; ne compte ni les révoqués ni les expirés", async () => {
    db.count.mockResolvedValue(MAX_ACTIVE_PREVIEW_LINKS);
    await expect(createPreviewLink({ articleId: "a1", adminId: "u1", days: 7, now: NOW })).rejects.toBeInstanceOf(TooManyPreviewLinksError);
    expect(db.create).not.toHaveBeenCalled();
    expect(db.count).toHaveBeenCalledWith({ where: { articleId: "a1", revokedAt: null, expiresAt: { gt: NOW } } });

    db.count.mockResolvedValue(MAX_ACTIVE_PREVIEW_LINKS - 1);
    db.create.mockResolvedValue({ id: "l2", createdAt: NOW, expiresAt: NOW });
    await expect(createPreviewLink({ articleId: "a1", adminId: "u1", days: 7, now: NOW })).resolves.toBeTruthy();
  });

  it("deux liens créés à la suite ont deux jetons différents", async () => {
    db.count.mockResolvedValue(0);
    db.create.mockResolvedValue({ id: "l", createdAt: NOW, expiresAt: NOW });
    const first = await createPreviewLink({ articleId: "a1", adminId: "u1", days: 3, now: NOW });
    const second = await createPreviewLink({ articleId: "a1", adminId: "u1", days: 3, now: NOW });
    expect(first.token).not.toBe(second.token);
  });
});

describe("findUsablePreviewLink", () => {
  const token = generatePreviewToken();
  const row = (over: Partial<{ articleId: string; expiresAt: Date; revokedAt: Date | null; lastUsedAt: Date | null }> = {}) => ({ id: "l1", articleId: "a1", expiresAt: new Date(NOW.getTime() + DAY), revokedAt: null, lastUsedAt: null, ...over });

  it("cherche par EMPREINTE, jamais par le jeton lui-même", async () => {
    db.findUnique.mockResolvedValue(row());
    await findUsablePreviewLink(token, "a1", NOW);
    expect(db.findUnique.mock.calls[0][0].where).toEqual({ tokenHash: hashPreviewToken(token) });
    expect(JSON.stringify(db.findUnique.mock.calls[0][0])).not.toContain(token);
  });

  it("un jeton de forme absurde ne touche même pas la base", async () => {
    for (const bad of ["", "abc", "a".repeat(10_000), `${token}x`]) expect(await findUsablePreviewLink(bad, "a1", NOW)).toBeNull();
    expect(db.findUnique).not.toHaveBeenCalled();
  });

  it("renvoie le lien d'un jeton valide POUR CE contenu", async () => {
    const expiresAt = new Date(NOW.getTime() + DAY);
    db.findUnique.mockResolvedValue(row({ expiresAt }));
    expect(await findUsablePreviewLink(token, "a1", NOW)).toEqual({ id: "l1", expiresAt });
  });

  it("le MÊME « rien » pour un jeton inconnu, d'un autre contenu, révoqué ou expiré (rien ne dit pourquoi)", async () => {
    db.findUnique.mockResolvedValue(null);
    expect(await findUsablePreviewLink(token, "a1", NOW)).toBeNull(); // inconnu
    db.findUnique.mockResolvedValue(row({ articleId: "a2" }));
    expect(await findUsablePreviewLink(token, "a1", NOW)).toBeNull(); // le jeton d'un AUTRE contenu n'ouvre pas celui-ci
    db.findUnique.mockResolvedValue(row({ revokedAt: new Date(NOW.getTime() - MIN) }));
    expect(await findUsablePreviewLink(token, "a1", NOW)).toBeNull(); // révoqué
    db.findUnique.mockResolvedValue(row({ expiresAt: NOW }));
    expect(await findUsablePreviewLink(token, "a1", NOW)).toBeNull(); // expiré, à l'échéance exacte
    db.findUnique.mockResolvedValue(row({ expiresAt: new Date(NOW.getTime() + 1) }));
    expect(await findUsablePreviewLink(token, "a1", NOW)).not.toBeNull(); // une milliseconde avant
    expect(db.update).toHaveBeenCalledTimes(1); // seul le dernier, valable, a noté son usage
  });

  it("note la consultation au plus une fois par minute : pas d'écriture à chaque affichage", async () => {
    db.findUnique.mockResolvedValue(row({ lastUsedAt: null }));
    await findUsablePreviewLink(token, "a1", NOW);
    expect(db.update).toHaveBeenCalledTimes(1);
    expect(db.update.mock.calls[0][0]).toEqual({ where: { id: "l1" }, data: { lastUsedAt: NOW } });

    db.update.mockClear();
    db.findUnique.mockResolvedValue(row({ lastUsedAt: new Date(NOW.getTime() - 30_000) })); // il y a 30 s
    await findUsablePreviewLink(token, "a1", NOW);
    expect(db.update).not.toHaveBeenCalled();

    db.findUnique.mockResolvedValue(row({ lastUsedAt: new Date(NOW.getTime() - MIN) })); // il y a 60 s pile
    await findUsablePreviewLink(token, "a1", NOW);
    expect(db.update).toHaveBeenCalledTimes(1);
  });

  it("l'échec de cette écriture n'empêche pas la relecture : c'est un simple compteur d'information", async () => {
    db.findUnique.mockResolvedValue(row());
    db.update.mockRejectedValue(new Error("écriture impossible"));
    expect(await findUsablePreviewLink(token, "a1", NOW)).toMatchObject({ id: "l1" });
  });
});

describe("revokePreviewLink", () => {
  it("révoque un lien actif de CE contenu, à l'instant donné", async () => {
    db.findFirst.mockResolvedValue({ id: "l1", revokedAt: null });
    expect(await revokePreviewLink("a1", "l1", NOW)).toBe(true);
    expect(db.findFirst).toHaveBeenCalledWith({ where: { id: "l1", articleId: "a1" }, select: { id: true, revokedAt: true } });
    expect(db.update).toHaveBeenCalledWith({ where: { id: "l1" }, data: { revokedAt: NOW } });
  });

  it("le lien d'un AUTRE contenu (ou inexistant) n'est pas révoqué par cette adresse : « introuvable »", async () => {
    db.findFirst.mockResolvedValue(null);
    expect(await revokePreviewLink("a1", "l-autre", NOW)).toBe(false);
    expect(db.update).not.toHaveBeenCalled();
  });

  it("est idempotent : un lien déjà révoqué garde sa date d'origine", async () => {
    db.findFirst.mockResolvedValue({ id: "l1", revokedAt: new Date("2026-01-01T00:00:00Z") });
    expect(await revokePreviewLink("a1", "l1", NOW)).toBe(true);
    expect(db.update).not.toHaveBeenCalled();
  });
});
