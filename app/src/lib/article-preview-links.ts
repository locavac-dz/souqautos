import { randomBytes } from "node:crypto";
import { keyedHash } from "@/lib/crypto/at-rest";
import { prisma } from "@/lib/prisma";

// Lot 146 — liens d'APERÇU d'un contenu non publié, pour un relecteur qui n'a PAS de compte administrateur (un juriste pour les
// démarches, un locuteur natif pour l'arabe). L'aperçu par compte administrateur (Lot 145) ne l'aidait pas.
//
// Un lien est un SECRET qui donne accès à un contenu non publié. Ce qui le protège :
//  - le jeton est aléatoire (256 bits) et n'est JAMAIS stocké : seule son empreinte (HMAC avec la clé du serveur) l'est, comme les codes
//    de secours de la double authentification. Une copie de la base ne permet pas de forger un lien, ni même de retrouver un jeton ;
//  - il est affiché UNE seule fois, à la création : on ne peut pas le relire ensuite, seulement en créer un autre ;
//  - il est lié à UN contenu (le jeton d'un guide n'ouvre pas un essai), à durée limitée, révocable, et plafonné en nombre ;
//  - il permet de LIRE seulement : il ne donne aucun droit d'administration, et ne crée aucune session.
// Un jeton invalide, expiré, révoqué ou d'un autre contenu donne le MÊME 404 que si rien n'existait.

export const PREVIEW_LINK_DURATIONS_DAYS = [1, 3, 7, 14, 30] as const;
export const DEFAULT_PREVIEW_LINK_DAYS = 7;
// Plafond de liens ACTIFS par contenu : un lien oublié dans un courriel est une porte ouverte de plus.
export const MAX_ACTIVE_PREVIEW_LINKS = 10;
// « Consulté le… » n'est réécrit qu'au plus une fois par minute : lire un aperçu ne doit pas écrire en base à chaque affichage.
const TOUCH_INTERVAL_MS = 60_000;
const DAY_MS = 24 * 60 * 60 * 1000;
const HASH_PURPOSE = "article-preview-link";

export function generatePreviewToken(): string {
  return randomBytes(32).toString("base64url"); // 43 caractères
}

// Forme attendue d'un jeton : filtre les valeurs absurdes (ou énormes) AVANT toute lecture en base ou tout calcul d'empreinte.
export function isPlausiblePreviewToken(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
}

export function hashPreviewToken(token: string): string {
  return keyedHash(HASH_PURPOSE, token);
}

// Une durée n'est valable que si elle figure dans la liste : jamais un nombre de jours libre venu du navigateur.
export function parsePreviewDays(value: unknown): number | null {
  return typeof value === "number" && (PREVIEW_LINK_DURATIONS_DAYS as readonly number[]).includes(value) ? value : null;
}

export type PreviewLinkState = "active" | "expired" | "revoked";

// Décision pure : un lien révoqué ne sert plus, même avant son échéance ; un lien échu ne sert plus, à la milliseconde près.
export function previewLinkState(link: { revokedAt: Date | null; expiresAt: Date }, now: Date): PreviewLinkState {
  if (link.revokedAt) return "revoked";
  return link.expiresAt.getTime() > now.getTime() ? "active" : "expired";
}

export function previewLinkExpiry(now: Date, days: number): Date {
  return new Date(now.getTime() + days * DAY_MS);
}

export class TooManyPreviewLinksError extends Error {
  constructor() {
    super("too_many_preview_links");
  }
}

// Crée un lien. Le jeton n'est renvoyé QU'ICI : il n'existe nulle part ailleurs.
export async function createPreviewLink(input: { articleId: string; adminId: string; days: number; now?: Date }) {
  const now = input.now ?? new Date();
  const active = await prisma.articlePreviewLink.count({ where: { articleId: input.articleId, revokedAt: null, expiresAt: { gt: now } } });
  if (active >= MAX_ACTIVE_PREVIEW_LINKS) throw new TooManyPreviewLinksError();

  const token = generatePreviewToken();
  const link = await prisma.articlePreviewLink.create({
    data: { articleId: input.articleId, createdById: input.adminId, tokenHash: hashPreviewToken(token), expiresAt: previewLinkExpiry(now, input.days) },
    select: { id: true, createdAt: true, expiresAt: true },
  });
  return { token, link };
}

// Le lien utilisable qui correspond à ce jeton POUR CE contenu, ou `null` — sans jamais dire pourquoi (invalide, d'un autre contenu,
// révoqué, expiré : la même réponse). Note l'usage (au plus une fois par minute).
export async function findUsablePreviewLink(token: string, articleId: string, now: Date = new Date()): Promise<{ id: string; expiresAt: Date } | null> {
  if (!isPlausiblePreviewToken(token)) return null;
  const link = await prisma.articlePreviewLink.findUnique({
    where: { tokenHash: hashPreviewToken(token) },
    select: { id: true, articleId: true, expiresAt: true, revokedAt: true, lastUsedAt: true },
  });
  if (!link || link.articleId !== articleId || previewLinkState(link, now) !== "active") return null;

  if (!link.lastUsedAt || now.getTime() - link.lastUsedAt.getTime() >= TOUCH_INTERVAL_MS) {
    // Un échec de cette écriture ne doit pas empêcher la relecture : c'est un simple compteur d'information.
    await prisma.articlePreviewLink.update({ where: { id: link.id }, data: { lastUsedAt: now } }).catch(() => undefined);
  }
  return { id: link.id, expiresAt: link.expiresAt };
}

// Révoque un lien de CE contenu. Idempotent ; `false` si le lien n'existe pas ou appartient à un autre contenu.
export async function revokePreviewLink(articleId: string, linkId: string, now: Date = new Date()): Promise<boolean> {
  const link = await prisma.articlePreviewLink.findFirst({ where: { id: linkId, articleId }, select: { id: true, revokedAt: true } });
  if (!link) return false;
  if (!link.revokedAt) await prisma.articlePreviewLink.update({ where: { id: link.id }, data: { revokedAt: now } });
  return true;
}

// Les liens d'un contenu, du plus récent au plus ancien, SANS jamais renvoyer de jeton (il n'est pas stocké).
export async function listPreviewLinks(articleId: string, limit = 20) {
  return prisma.articlePreviewLink.findMany({
    where: { articleId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, createdAt: true, expiresAt: true, revokedAt: true, lastUsedAt: true, createdBy: { select: { email: true } } },
  });
}
