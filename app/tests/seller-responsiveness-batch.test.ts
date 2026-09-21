import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getLoadDatabaseUrl } from "../scripts/load-database";
import {
  RESPONSIVENESS_MAX_CONVERSATIONS,
  RESPONSIVENESS_WINDOW_DAYS,
  computeResponsiveness,
  type ConversationTiming,
  type Responsiveness,
} from "@/lib/seller-responsiveness";

// Lot 143 — la lecture GROUPÉE de la réactivité (une requête pour tous les vendeurs d'une page) donne EXACTEMENT ce que donnait la
// lecture du Lot 141 (deux requêtes par vendeur). Le calcul n'a pas changé, seulement la façon de lire : ce test le PROUVE, sur les 600
// vendeurs et ~12 000 conversations de la base de charge (`npm run load:seed`), plus des cas piégés insérés exprès puis retirés.
// Se SAUTE si cette base est absente.
//
// La référence ci-dessous est la copie CONFORME de l'algorithme du Lot 141 (deux requêtes par vendeur) : elle ne doit jamais être
// « améliorée », c'est son immobilité qui fait la valeur de la comparaison.

const DAY = 86_400_000;
const HOUR = 3_600_000;
const MINUTE = 60_000;

let prisma: PrismaClient | null = null;
let ready = false;
let batched: (ids: string[], now: Date) => Promise<Map<string, Responsiveness>>;
let now: Date;
let sellerIds: string[] = [];

async function reference(sellerId: string, at: Date): Promise<Responsiveness> {
  const since = new Date(at.getTime() - (RESPONSIVENESS_WINDOW_DAYS + 1) * DAY);
  const conversations = await prisma!.conversation.findMany({
    where: { sellerId, createdAt: { gte: since } },
    select: { id: true, buyerId: true },
    orderBy: { createdAt: "desc" },
    take: RESPONSIVENESS_MAX_CONVERSATIONS,
  });
  if (conversations.length === 0) return computeResponsiveness([], at);
  const firstMessages = await prisma!.message.groupBy({
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
    if (!buyerFirstMessageAt) continue;
    const replies = senders.filter((s) => s.senderId !== conversation.buyerId).map((s) => s.at.getTime());
    timings.push({ buyerFirstMessageAt, sellerFirstReplyAt: replies.length === 0 ? null : new Date(Math.min(...replies)) });
  }
  return computeResponsiveness(timings, at);
}

const FIXTURE = "zz-eq-";
const FIXTURE_SELLER = `${FIXTURE}vendeur`;
const CAP_SELLER = `${FIXTURE}vendeur-plafond`;
const COLLABORATOR = `${FIXTURE}collaborateur`;

async function cleanup() {
  await prisma!.conversation.deleteMany({ where: { id: { startsWith: FIXTURE } } });
  await prisma!.user.deleteMany({ where: { id: { startsWith: FIXTURE } } });
}

beforeAll(async () => {
  try {
    const url = getLoadDatabaseUrl();
    process.env.DATABASE_URL = url; // le service lit la base via `@/lib/prisma`, qui la prend dans l'environnement
    prisma = new PrismaClient({ datasourceUrl: url });
    ready = (await prisma.conversation.count({ where: { id: { startsWith: "charge-conv-" } } })) >= 1000;
    if (!ready) return;
    batched = (await import("@/lib/seller-responsiveness-service")).getSellerResponsivenessForSellers;
    now = new Date();
    await cleanup(); // au cas où une exécution précédente aurait été interrompue

    sellerIds = (await prisma.user.findMany({ where: { email: { startsWith: "charge-" } }, select: { id: true }, orderBy: { id: "asc" } })).map((u) => u.id);
    const listings = await prisma.listing.findMany({ where: { id: { startsWith: "charge-" } }, select: { id: true }, take: 1 });
    const listingId = listings[0].id;

    // Des acheteurs frais : la paire (annonce, acheteur) est unique, et le vendeur de fixture n'est celui d'aucune annonce réelle.
    const buyerCount = 260;
    await prisma.user.createMany({
      data: [
        { id: FIXTURE_SELLER, email: `${FIXTURE}vendeur@example.dz` },
        { id: CAP_SELLER, email: `${FIXTURE}plafond@example.dz` },
        { id: COLLABORATOR, email: `${FIXTURE}collab@example.dz` },
        ...Array.from({ length: buyerCount }, (_, i) => ({ id: `${FIXTURE}acheteur-${i}`, email: `${FIXTURE}acheteur-${i}@example.dz` })),
      ],
    });

    let buyerIndex = 0;
    const at = (msAgo: number) => new Date(now.getTime() - msAgo);
    // Une conversation de fixture ; `messages` donne, pour chaque message, qui l'écrit ('buyer' | 'seller' | 'collab'), quand, et s'il est supprimé.
    const conversation = async (seller: string, createdAgo: number, messages: { by: "buyer" | "seller" | "collab"; agoMs: number; deleted?: boolean }[], label: string) => {
      const buyerId = `${FIXTURE}acheteur-${buyerIndex++}`;
      const id = `${FIXTURE}${label}-${buyerIndex}`;
      await prisma!.conversation.create({ data: { id, listingId, buyerId, sellerId: seller, createdAt: at(createdAgo) } });
      if (messages.length > 0) {
        await prisma!.message.createMany({
          data: messages.map((m) => ({
            conversationId: id,
            senderId: m.by === "buyer" ? buyerId : m.by === "seller" ? seller : COLLABORATOR,
            content: "x",
            createdAt: at(m.agoMs),
            deletedAt: m.deleted ? at(m.agoMs) : null,
          })),
        });
      }
    };

    const S = FIXTURE_SELLER;
    await conversation(S, 5 * DAY, [{ by: "buyer", agoMs: 5 * DAY }, { by: "seller", agoMs: 5 * DAY - 10 * MINUTE }], "repondue");
    await conversation(S, 5 * DAY, [{ by: "buyer", agoMs: 5 * DAY }], "ignoree");
    await conversation(S, HOUR, [{ by: "buyer", agoMs: HOUR }], "trop-recente"); // exclue : délai de grâce
    await conversation(S, HOUR, [{ by: "buyer", agoMs: HOUR }, { by: "seller", agoMs: HOUR - 5 * MINUTE }], "recente-repondue"); // gardée
    await conversation(S, 4 * DAY, [{ by: "buyer", agoMs: 4 * DAY, deleted: true }, { by: "seller", agoMs: 4 * DAY - HOUR }], "question-supprimee"); // rien à quoi répondre
    await conversation(S, 4 * DAY, [{ by: "buyer", agoMs: 4 * DAY }, { by: "seller", agoMs: 4 * DAY - HOUR, deleted: true }], "reponse-supprimee"); // sans réponse
    await conversation(S, 3 * DAY, [{ by: "buyer", agoMs: 3 * DAY }, { by: "seller", agoMs: 3 * DAY - 30 * MINUTE }, { by: "collab", agoMs: 3 * DAY - 10 * MINUTE }], "deux-repondeurs"); // la plus tôt
    await conversation(S, 3 * DAY, [{ by: "seller", agoMs: 3 * DAY + HOUR }, { by: "buyer", agoMs: 3 * DAY }], "reponse-avant-question"); // incohérent
    await conversation(S, 2 * DAY + HOUR, [], "sans-message");
    await conversation(S, 2 * DAY + HOUR, [{ by: "seller", agoMs: 2 * DAY }], "vendeur-seul"); // l'acheteur n'a rien écrit
    await conversation(S, (RESPONSIVENESS_WINDOW_DAYS + 30) * DAY, [{ by: "buyer", agoMs: (RESPONSIVENESS_WINDOW_DAYS + 30) * DAY }, { by: "seller", agoMs: (RESPONSIVENESS_WINDOW_DAYS + 30) * DAY - MINUTE }], "hors-fenetre");
    await conversation(S, RESPONSIVENESS_WINDOW_DAYS * DAY - 5 * MINUTE, [{ by: "buyer", agoMs: RESPONSIVENESS_WINDOW_DAYS * DAY - 5 * MINUTE }, { by: "seller", agoMs: RESPONSIVENESS_WINDOW_DAYS * DAY - 20 * MINUTE }], "bord-dedans");
    await conversation(S, RESPONSIVENESS_WINDOW_DAYS * DAY + 5 * MINUTE, [{ by: "buyer", agoMs: RESPONSIVENESS_WINDOW_DAYS * DAY + 5 * MINUTE }, { by: "seller", agoMs: RESPONSIVENESS_WINDOW_DAYS * DAY }], "bord-dehors");

    // Un vendeur AU-DELÀ du plafond : 215 conversations, dont les 15 plus anciennes seules ont été ignorées. Dates toutes distinctes
    // (pas d'égalité à la frontière du plafond : l'ordre de deux conversations simultanées n'est défini par aucune des deux lectures).
    for (let i = 0; i < 215; i++) {
      const agoMs = 3 * DAY + i * 6 * HOUR; // de 3 jours à ~ 57 jours : toutes dans la fenêtre, toutes distinctes
      // Les 15 plus anciennes (i >= 200) sont réactives ; les 200 plus récentes sont TOUTES ignorées : si le plafond n'est pas
      // appliqué de la même façon, le taux de réponse diffère aussitôt.
      await conversation(CAP_SELLER, agoMs, i >= 200 ? [{ by: "buyer", agoMs }, { by: "seller", agoMs: agoMs - MINUTE }] : [{ by: "buyer", agoMs }], "plafond");
    }
  } catch {
    ready = false;
  }
}, 300_000);

afterAll(async () => {
  if (prisma) {
    await cleanup().catch(() => undefined);
    await prisma.$disconnect();
  }
});

describe("lecture groupée de la réactivité : aucun résultat ne change", () => {
  it("l'échantillon est assez large et varié pour que la comparaison ait du sens", async () => {
    if (!ready) return;
    const results = await batched(sellerIds, now);
    expect(results.size).toBe(sellerIds.length);
    const all = [...results.values()];
    expect(all.filter((r) => r.eligibleConversations === 0).length).toBeGreaterThan(0); // des vendeurs sans conversation
    expect(all.filter((r) => r.eligibleConversations >= RESPONSIVENESS_MAX_CONVERSATIONS - 5).length).toBeGreaterThan(0); // et des vendeurs au plafond
    expect(all.filter((r) => r.eligibleConversations >= 5 && r.responseRate >= 0.8).length).toBeGreaterThan(20); // dont des vendeurs qui méritent le badge
    expect(all.filter((r) => r.eligibleConversations >= 5 && r.responseRate < 0.8).length).toBeGreaterThan(20); // et d'autres qui ne le méritent pas
  }, 120_000);

  it("les 600 vendeurs de la base de charge, lus en UNE fois, ont exactement la réactivité de l'ancienne lecture", async () => {
    if (!ready) return;
    const results = await batched(sellerIds, now);
    const differences: string[] = [];
    for (const sellerId of sellerIds) {
      const before = await reference(sellerId, now);
      const after = results.get(sellerId);
      if (JSON.stringify(before) !== JSON.stringify(after)) differences.push(`${sellerId} : avant ${JSON.stringify(before)} / après ${JSON.stringify(after)}`);
    }
    expect(differences).toEqual([]);
  }, 300_000);

  it("les cas piégés (question ou réponse supprimée, deux répondeurs, hors fenêtre, bords, sans message…) donnent le même résultat", async () => {
    if (!ready) return;
    const results = await batched([FIXTURE_SELLER], now);
    const before = await reference(FIXTURE_SELLER, now);
    expect(results.get(FIXTURE_SELLER)).toEqual(before);
    // Et le résultat est bien celui qu'on attend à la main : les fixtures ne sont pas comparées à du vide.
    // Jugeables (7) : repondue, ignoree, recente-repondue, reponse-supprimee, deux-repondeurs, reponse-avant-question, bord-dedans.
    // Exclues : trop-recente (délai de grâce), question-supprimee et vendeur-seul (l'acheteur n'a rien écrit), sans-message,
    // hors-fenetre et bord-dehors (hors des 90 jours).
    expect(before.eligibleConversations).toBe(7);
    // Répondues (4) : repondue (10 min), recente-repondue (5 min), deux-repondeurs (10 min : la réponse la plus tôt),
    // bord-dedans (15 min). Une réponse supprimée, ou antérieure à la question, n'en est pas une.
    expect(before.respondedConversations).toBe(4);
    expect(before.medianReplyMinutes).toBe(10); // 5, 10, 10, 15
    expect(before.responseRate).toBeCloseTo(4 / 7);
  });

  it("au-delà du plafond, seules les 200 conversations les plus récentes comptent, comme avant", async () => {
    if (!ready) return;
    const after = (await batched([CAP_SELLER], now)).get(CAP_SELLER)!;
    const before = await reference(CAP_SELLER, now);
    expect(after).toEqual(before);
    expect(after.eligibleConversations).toBe(RESPONSIVENESS_MAX_CONVERSATIONS);
    expect(after.respondedConversations).toBe(0); // les 15 plus anciennes, seules à avoir eu une réponse, sont hors plafond
  });

  it("un vendeur lu seul, ou parmi d'autres, ou en doublon, a le même résultat ; un identifiant inconnu donne une réactivité vide", async () => {
    if (!ready) return;
    const alone = (await batched([sellerIds[5]], now)).get(sellerIds[5]);
    const among = (await batched([sellerIds[1], sellerIds[5], sellerIds[9], sellerIds[5]], now)).get(sellerIds[5]);
    expect(alone).toEqual(among);
    expect((await batched([], now)).size).toBe(0);
    const unknown = (await batched(["zz-inconnu"], now)).get("zz-inconnu");
    expect(unknown).toEqual({ eligibleConversations: 0, respondedConversations: 0, responseRate: 0, medianReplyMinutes: null });
  });
});
