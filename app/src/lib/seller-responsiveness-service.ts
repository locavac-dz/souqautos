import { prisma } from "@/lib/prisma";
import {
  RESPONSIVENESS_MAX_CONVERSATIONS,
  RESPONSIVENESS_WINDOW_DAYS,
  computeResponsiveness,
  type ConversationTiming,
  type Responsiveness,
} from "@/lib/seller-responsiveness";

// Lot 141 — lit en base ce qu'il faut pour calculer la réactivité d'un vendeur (le calcul lui-même est pur :
// src/lib/seller-responsiveness.ts). Deux requêtes, quel que soit le nombre de conversations.
//
// « Le vendeur a répondu » = un message de la conversation venant de QUELQU'UN D'AUTRE QUE L'ACHETEUR. C'est volontaire : sur
// un compte professionnel, un collaborateur peut répondre à la place du titulaire (Lot 42) — pour l'acheteur, la réponse est
// arrivée, c'est tout ce qui compte. Les messages supprimés ne comptent pas : on mesure ce que l'acheteur a réellement reçu.
//
// COÛT BORNÉ : au plus les 200 conversations les plus récentes de la fenêtre (RESPONSIVENESS_MAX_CONVERSATIONS). Cette page
// est vue à chaque consultation d'annonce ; sans cette borne, un concessionnaire à 3 000 conversations la ralentirait pour
// tout le monde. Mesuré : 3,9 ms pour un vendeur sans conversation, 13 à 22 ms pour 300 conversations avant la borne.

const DAY_MS = 24 * 60 * 60 * 1000;

export async function getSellerResponsiveness(sellerId: string, now: Date = new Date()): Promise<Responsiveness> {
  // Pré-filtre en base sur la date de la conversation, avec un jour de marge : c'est la date du PREMIER MESSAGE de l'acheteur
  // qui fait foi (le calcul pur retranche ensuite ce qui déborde), et les deux peuvent différer de quelques instants.
  const since = new Date(now.getTime() - (RESPONSIVENESS_WINDOW_DAYS + 1) * DAY_MS);
  const conversations = await prisma.conversation.findMany({
    where: { sellerId, createdAt: { gte: since } },
    select: { id: true, buyerId: true },
    orderBy: { createdAt: "desc" },
    take: RESPONSIVENESS_MAX_CONVERSATIONS,
  });
  if (conversations.length === 0) return computeResponsiveness([], now);

  // Première prise de parole de chaque participant, par conversation : une seule requête groupée, jamais tous les messages.
  const firstMessages = await prisma.message.groupBy({
    by: ["conversationId", "senderId"],
    where: { conversationId: { in: conversations.map((c) => c.id) }, deletedAt: null },
    _min: { createdAt: true },
  });

  const bySender = new Map<string, { senderId: string; at: Date }[]>();
  for (const row of firstMessages) {
    if (!row._min.createdAt) continue;
    const list = bySender.get(row.conversationId) ?? [];
    list.push({ senderId: row.senderId, at: row._min.createdAt });
    bySender.set(row.conversationId, list);
  }

  const timings: ConversationTiming[] = [];
  for (const conversation of conversations) {
    const senders = bySender.get(conversation.id) ?? [];
    const buyerFirstMessageAt = senders.find((s) => s.senderId === conversation.buyerId)?.at;
    if (!buyerFirstMessageAt) continue; // l'acheteur n'a rien écrit : il n'y a rien à quoi répondre

    const replies = senders.filter((s) => s.senderId !== conversation.buyerId).map((s) => s.at.getTime());
    timings.push({ buyerFirstMessageAt, sellerFirstReplyAt: replies.length === 0 ? null : new Date(Math.min(...replies)) });
  }

  return computeResponsiveness(timings, now);
}
