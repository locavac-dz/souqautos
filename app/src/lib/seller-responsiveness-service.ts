import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createTtlBatchCache } from "@/lib/ttl-cache";
import {
  RESPONSIVENESS_MAX_CONVERSATIONS,
  RESPONSIVENESS_WINDOW_DAYS,
  computeResponsiveness,
  type ConversationTiming,
  type Responsiveness,
} from "@/lib/seller-responsiveness";

// Lot 141 / 143 — lit en base ce qu'il faut pour calculer la réactivité de un ou plusieurs vendeurs (le calcul lui-même est pur :
// src/lib/seller-responsiveness.ts).
//
// UNE SEULE requête, quel que soit le nombre de vendeurs (Lot 143) : la fiche d'annonce en interroge un, mais une page de résultats
// en affiche une vingtaine, et la version du Lot 141 (deux requêtes par vendeur) en aurait fait une quarantaine par page.
//
// « Le vendeur a répondu » = un message de la conversation venant de QUELQU'UN D'AUTRE QUE L'ACHETEUR. C'est volontaire : sur
// un compte professionnel, un collaborateur peut répondre à la place du titulaire (Lot 42) — pour l'acheteur, la réponse est
// arrivée, c'est tout ce qui compte. Les messages supprimés ne comptent pas : on mesure ce que l'acheteur a réellement reçu.
//
// COÛT BORNÉ : au plus les 200 conversations les plus récentes de la fenêtre PAR VENDEUR (RESPONSIVENESS_MAX_CONVERSATIONS), donc au
// plus 200 × (nombre de vendeurs de la page) lignes. Un concessionnaire à 3 000 conversations ne ralentit personne.
// Une conversation où l'acheteur n'a rien écrit (ou sans aucun message) n'a rien à quoi répondre : elle n'apparaît pas.

const DAY_MS = 24 * 60 * 60 * 1000;

type TimingRow = { sellerId: string; buyerFirst: Date | null; sellerFirst: Date | null };

export async function getSellerResponsivenessForSellers(sellerIds: string[], now: Date = new Date()): Promise<Map<string, Responsiveness>> {
  const uniqueIds = [...new Set(sellerIds)];
  if (uniqueIds.length === 0) return new Map();

  // Pré-filtre en base sur la date de la conversation, avec un jour de marge : c'est la date du PREMIER MESSAGE de l'acheteur
  // qui fait foi (le calcul pur retranche ensuite ce qui déborde), et les deux peuvent différer de quelques instants.
  // La date est passée en TEXTE puis convertie en « timestamp » sans fuseau, comme les colonnes de Prisma (toujours en UTC) : un
  // paramètre « Date » serait lu avec le fuseau de la session et décalerait la borne de plusieurs heures.
  const since = new Date(now.getTime() - (RESPONSIVENESS_WINDOW_DAYS + 1) * DAY_MS).toISOString();

  const rows = await prisma.$queryRaw<TimingRow[]>(Prisma.sql`
    WITH recent AS (
      SELECT c."id", c."sellerId", c."buyerId",
             ROW_NUMBER() OVER (PARTITION BY c."sellerId" ORDER BY c."createdAt" DESC) AS rank
      FROM "Conversation" c
      WHERE c."sellerId" = ANY(${uniqueIds}) AND c."createdAt" >= ${since}::timestamp
    )
    SELECT r."sellerId" AS "sellerId",
           MIN(m."createdAt") FILTER (WHERE m."senderId" = r."buyerId") AS "buyerFirst",
           MIN(m."createdAt") FILTER (WHERE m."senderId" <> r."buyerId") AS "sellerFirst"
    FROM recent r
    JOIN "Message" m ON m."conversationId" = r."id" AND m."deletedAt" IS NULL
    WHERE r.rank <= ${RESPONSIVENESS_MAX_CONVERSATIONS}
    GROUP BY r."id", r."sellerId"
  `);

  const timingsBySeller = new Map<string, ConversationTiming[]>(uniqueIds.map((id) => [id, []]));
  for (const row of rows) {
    if (!row.buyerFirst) continue; // l'acheteur n'a rien écrit : il n'y a rien à quoi répondre
    timingsBySeller.get(row.sellerId)?.push({ buyerFirstMessageAt: row.buyerFirst, sellerFirstReplyAt: row.sellerFirst });
  }
  return new Map([...timingsBySeller].map(([sellerId, timings]) => [sellerId, computeResponsiveness(timings, now)]));
}

export async function getSellerResponsiveness(sellerId: string, now: Date = new Date()): Promise<Responsiveness> {
  return (await getSellerResponsivenessForSellers([sellerId], now)).get(sellerId) ?? computeResponsiveness([], now);
}

// --- Version avec cache, pour les pages de RÉSULTATS (Lot 143) ---------------------------------------------------------------------
//
// Une page de résultats affiche une vingtaine de vendeurs, et les gros vendeurs y reviennent sans cesse (les annonces sont très
// inégalement réparties). Le cache n'est pas un confort, il est INDISPENSABLE : mesuré sur la base de charge (100 000 annonces, 12 000
// conversations), recherche à 10 visiteurs simultanés — SANS cache, p95 = 1 491 ms (le budget de 700 est dépassé, p50 = 1 118 ms) ;
// AVEC cache, p95 = 458 ms, soit exactement l'état d'avant le badge (472 ms). La lecture groupée d'une page coûte 19 à 35 ms de base de
// données (les 20 plus gros vendeurs : ~7 400 conversations lues), et sous charge ces coûts s'additionnent. La donnée bougeant
// lentement, elle est gardée 5 minutes par vendeur, et seuls les vendeurs absents du cache sont lus, en une seule requête.
//
// Conséquence assumée : sur ces pages, un badge peut apparaître ou disparaître avec jusqu'à 5 minutes de retard. La fiche d'annonce, la
// page du vendeur et son tableau de bord, elles, lisent toujours en direct (getSellerResponsiveness) : un seul vendeur, coût négligeable,
// et le vendeur qui vérifie son propre état doit le voir tel qu'il est.
// RESPONSIVENESS_CACHE_TTL_MS règle la durée en millisecondes ; 0 désactive le cache (les tests de bout en bout, qui modifient des
// conversations puis regardent tout de suite le résultat).

export const RESPONSIVENESS_CACHE_TTL_MS = 5 * 60 * 1000;
export const RESPONSIVENESS_CACHE_MAX_ENTRIES = 5000;

function cacheTtl(): number {
  const raw = process.env.RESPONSIVENESS_CACHE_TTL_MS;
  if (raw === undefined || raw.trim() === "") return RESPONSIVENESS_CACHE_TTL_MS;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : RESPONSIVENESS_CACHE_TTL_MS;
}

const responsivenessCache = createTtlBatchCache<Responsiveness>({
  name: "seller-responsiveness",
  maxEntries: RESPONSIVENESS_CACHE_MAX_ENTRIES,
  ttlMs: cacheTtl,
});

export function getSellerResponsivenessCached(sellerIds: string[]): Promise<Map<string, Responsiveness>> {
  return responsivenessCache.getMany(sellerIds, (missing) => getSellerResponsivenessForSellers(missing));
}
