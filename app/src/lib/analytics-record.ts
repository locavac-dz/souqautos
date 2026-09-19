import { prisma } from "@/lib/prisma";
import { publishedNow } from "@/lib/blog-publication";
import { RETENTION_DAYS, type ClassifiedPath, type DeviceClass, type PublicPage, type ReferrerCategory } from "@/lib/analytics";

// Lot 124 — écriture des compteurs d'audience. Voir src/lib/analytics.ts pour ce qui est (et n'est
// jamais) gardé.

// --- Détail de contenu : seulement s'il existe vraiment ------------------------------------------------------------
//
// Sans ce contrôle, n'importe qui pourrait envoyer des milliers d'identifiants inventés et gonfler
// la table. Le résultat est mis en cache (les mêmes contenus reviennent sans cesse), y compris les
// refus, pour qu'une rafale d'identifiants inventés ne fasse pas une requête chacun.
const POSITIVE_TTL_MS = 10 * 60 * 1000;
const NEGATIVE_TTL_MS = 60 * 1000;
const MAX_CACHE_ENTRIES = 2000;
const detailCache = new Map<string, { ok: boolean; expires: number }>();

export function clearDetailCache(): void {
  detailCache.clear();
}

async function contentExists(page: PublicPage, detail: string, now: Date): Promise<boolean> {
  switch (page) {
    case "/mag/[slug]":
      return (await prisma.blogArticle.findFirst({ where: { slug: detail, kind: "ARTICLE", ...publishedNow(now) }, select: { id: true } })) !== null;
    case "/essais/[slug]":
      return (await prisma.blogArticle.findFirst({ where: { slug: detail, kind: "ESSAI", ...publishedNow(now) }, select: { id: true } })) !== null;
    case "/voitures/[marque]":
      return (await prisma.brand.findUnique({ where: { slug: detail }, select: { id: true } })) !== null;
    case "/voitures/[marque]/[modele]": {
      const [brandSlug, modelSlug] = detail.split("/");
      return (await prisma.model.findFirst({ where: { slug: modelSlug, brand: { slug: brandSlug } }, select: { id: true } })) !== null;
    }
    case "/wilaya/[wilaya]":
      return (await prisma.wilaya.findUnique({ where: { slug: detail }, select: { id: true } })) !== null;
    default:
      return false;
  }
}

export async function isKnownContentDetail(page: PublicPage, detail: string, now: Date = new Date()): Promise<boolean> {
  if (detail === "") return false;
  const key = `${page}|${detail}`;
  const cached = detailCache.get(key);
  if (cached && cached.expires > now.getTime()) return cached.ok;

  const ok = await contentExists(page, detail, now);
  if (detailCache.size >= MAX_CACHE_ENTRIES) detailCache.clear();
  detailCache.set(key, { ok, expires: now.getTime() + (ok ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS) });
  return ok;
}

// --- Écriture ------------------------------------------------------------------------------------------------------------------

export type PageViewRecord = ClassifiedPath & { device: DeviceClass; referrer: ReferrerCategory };

// Ne lève jamais d'exception : la mesure ne doit pas gêner le site. Un contenu inconnu compte quand
// même comme une vue de la page, sans détail. Upsert atomique en SQL : des visites simultanées
// s'additionnent. Le jour est la date civile algérienne (UTC+1), calculée par la base.
export async function recordPageView(record: PageViewRecord, now: Date = new Date()): Promise<void> {
  try {
    const detail = (await isKnownContentDetail(record.page, record.detail, now)) ? record.detail : "";
    await prisma.$executeRaw`
      INSERT INTO "PageViewDay" ("day", "page", "detail", "locale", "device", "referrer", "count")
      VALUES ((now() AT TIME ZONE 'Africa/Algiers')::date, ${record.page}, ${detail}, ${record.locale}, ${record.device}, ${record.referrer}, 1)
      ON CONFLICT ("day", "page", "detail", "locale", "device", "referrer") DO UPDATE SET "count" = "PageViewDay"."count" + 1`;
  } catch (error) {
    console.error(`[audience] comptage impossible : ${(error as Error).message}`);
  }
}

// --- Conservation limitée ------------------------------------------------------------------------------------------------------

// Supprime les compteurs de plus de RETENTION_DAYS jours ; rend le nombre de lignes supprimées.
export async function purgeOldPageViews(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const result = await prisma.pageViewDay.deleteMany({ where: { day: { lt: cutoff } } });
  return result.count;
}
