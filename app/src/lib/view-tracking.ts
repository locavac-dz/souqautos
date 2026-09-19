import { prisma } from "@/lib/prisma";

// Lot 122 — comptage des vues d'une annonce, en total (`Listing.views`) et par jour
// (`ListingViewDay`, pour les statistiques des professionnels).

// Robots d'indexation, aperçus de liens, outils de supervision et bibliothèques HTTP : leurs
// passages gonfleraient les vues et fausseraient le taux de contact. Une requête sans
// `User-Agent` n'est pas un navigateur non plus.
const BOT_PATTERN =
  /bot|crawl|spider|slurp|facebookexternalhit|preview|embedly|whatsapp\/|headless|lighthouse|pingdom|uptime|monitor|curl\/|wget|python-requests|httpclient|node-fetch|axios|go-http-client|okhttp|java\//i;

export function isLikelyBot(userAgent: string | null | undefined): boolean {
  if (!userAgent) return true;
  return BOT_PATTERN.test(userAgent);
}

// Ne lève jamais d'exception : une statistique ne doit pas empêcher l'affichage de l'annonce.
export async function recordListingView(listingId: string): Promise<void> {
  try {
    // Les deux compteurs bougent ensemble ou pas du tout. L'upsert est écrit en SQL pour être
    // atomique : deux visites simultanées s'additionnent au lieu de s'écraser.
    await prisma.$transaction([
      prisma.listing.update({ where: { id: listingId }, data: { views: { increment: 1 } } }),
      prisma.$executeRaw`
        INSERT INTO "ListingViewDay" ("listingId", "day", "count")
        VALUES (${listingId}, (now() AT TIME ZONE 'Africa/Algiers')::date, 1)
        ON CONFLICT ("listingId", "day") DO UPDATE SET "count" = "ListingViewDay"."count" + 1`,
    ]);
  } catch (error) {
    console.error(`[vues] comptage impossible : ${(error as Error).message}`);
  }
}
