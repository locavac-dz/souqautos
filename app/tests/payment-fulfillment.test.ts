import { beforeEach, describe, expect, it, vi } from "vitest";

// Lot 265 — la couche d'activation des paiements, testée avec Prisma simulé : transition gagnante unique,
// activation refusée quand l'annonce n'est plus activable, transaction annulée sur une course, courriel
// envoyé une seule fois et seulement après validation.
// `vi.mock` est hissé en tête de fichier : tout ce que sa fabrique référence doit l'être aussi (`vi.hoisted`).
const { findUniqueOrder, updateManyOrder, updateManyListing, findUniqueProOrder, updateManyProOrder, upsertSubscription, sendEmail, db, $transaction } = vi.hoisted(() => {
  const findUniqueOrder = vi.fn();
  const updateManyOrder = vi.fn();
  const updateManyListing = vi.fn();
  const findUniqueProOrder = vi.fn();
  const updateManyProOrder = vi.fn();
  const upsertSubscription = vi.fn();
  const sendEmail = vi.fn();
  const db = {
    paymentOrder: { findUnique: (...a: unknown[]) => findUniqueOrder(...a), updateMany: (...a: unknown[]) => updateManyOrder(...a) },
    proSubscriptionOrder: { findUnique: (...a: unknown[]) => findUniqueProOrder(...a), updateMany: (...a: unknown[]) => updateManyProOrder(...a) },
    listing: { updateMany: (...a: unknown[]) => updateManyListing(...a) },
    proSubscription: { upsert: (...a: unknown[]) => upsertSubscription(...a) },
  };
  // La transaction simulée exécute la fonction avec le même client : une exception la fait échouer comme en vrai.
  const $transaction = vi.fn(async (fn: (tx: typeof db) => Promise<unknown>) => fn(db));
  return { findUniqueOrder, updateManyOrder, updateManyListing, findUniqueProOrder, updateManyProOrder, upsertSubscription, sendEmail, db, $transaction };
});
// Le faux client ne porte que les méthodes utilisées : on le présente sous le type attendu par les fonctions.
const asDb = db as unknown as Parameters<typeof cancelPendingOrdersForListing>[0];

vi.mock("@/lib/prisma", () => ({ prisma: { ...db, $transaction: (fn: (tx: typeof db) => Promise<unknown>) => $transaction(fn) } }));
vi.mock("@/lib/mailer", () => ({ sendEmail: (...a: unknown[]) => sendEmail(...a), escapeHtml: (s: string) => s }));
vi.mock("@/lib/site", () => ({ SITE_URL: "https://souqauto.example" }));
vi.mock("next-intl/server", () => ({ getTranslations: async () => (key: string) => key }));

import { computeExpiryDate } from "@/lib/listing-lifecycle";
import {
  cancelPendingOrdersForListing,
  cancelPendingOrdersForUser,
  confirmListingFormulaOrder,
  confirmProSubscriptionOrder,
  fulfillListingFormulaOrderFromProvider,
} from "@/lib/payment-fulfillment";

const NOW = new Date("2026-10-08T12:00:00Z");
const USER = { id: "u1", email: "vendeur@example.dz", locale: "fr" };
const LISTING = { id: "l1", title: "Clio", status: "PUBLIEE", publishedAt: new Date("2026-10-01T00:00:00Z"), formula: "STANDARD" };
const ORDER = { id: "o1", status: "EN_ATTENTE", formula: "PREMIUM", amountDzd: 1000, provider: "CHARGILY", listing: LISTING, user: USER };

beforeEach(() => {
  findUniqueOrder.mockReset().mockResolvedValue(ORDER);
  updateManyOrder.mockReset().mockResolvedValue({ count: 1 });
  updateManyListing.mockReset().mockResolvedValue({ count: 1 });
  findUniqueProOrder.mockReset();
  updateManyProOrder.mockReset().mockResolvedValue({ count: 1 });
  upsertSubscription.mockReset().mockResolvedValue({});
  sendEmail.mockReset().mockResolvedValue(null);
  $transaction.mockClear();
});

describe("confirmListingFormulaOrder", () => {
  it("confirms the order, activates the formula only on an upgradable listing, and emails once — all inside one transaction", async () => {
    expect(await confirmListingFormulaOrder("o1", NOW, { kind: "provider" })).toBe("confirmed");
    expect($transaction).toHaveBeenCalledOnce();
    expect(updateManyOrder).toHaveBeenCalledWith({
      where: { id: "o1", status: { in: ["EN_ATTENTE", "ANNULEE"] } },
      data: { status: "CONFIRMEE", paidAt: NOW, reviewedAt: NOW, reviewedById: null, reviewNote: null },
    });
    const activation = updateManyListing.mock.calls[0][0];
    expect(activation.where).toEqual({ id: "l1", status: { in: ["PUBLIEE", "EXPIREE"] } });
    expect(activation.data).toMatchObject({ formula: "PREMIUM", status: "PUBLIEE", expiryReminderSentAt: null, publishedAt: LISTING.publishedAt });
    expect(activation.data.expiresAt).toEqual(computeExpiryDate(NOW, 45)); // PREMIUM : 45 jours (calendrier local, comme le renouvellement)
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(sendEmail.mock.calls[0][0].html).toContain("paymentOnlineApprovedBody");
  });

  it("records the admin as reviewer, with the note, and uses the transfer wording for a VIREMENT order", async () => {
    findUniqueOrder.mockResolvedValue({ ...ORDER, provider: "VIREMENT" });
    expect(await confirmListingFormulaOrder("o1", NOW, { kind: "admin", adminId: "admin-1", note: "Virement reçu le 8/10" })).toBe("confirmed");
    expect(updateManyOrder.mock.calls[0][0].data).toMatchObject({ reviewedById: "admin-1", reviewNote: "Virement reçu le 8/10", paidAt: NOW });
    expect(sendEmail.mock.calls[0][0].html).toContain("paymentApprovedBody");
  });

  it("re-publishes an EXPIREE listing with a fresh publishedAt", async () => {
    findUniqueOrder.mockResolvedValue({ ...ORDER, listing: { ...LISTING, status: "EXPIREE" } });
    await confirmListingFormulaOrder("o1", NOW, { kind: "provider" });
    expect(updateManyListing.mock.calls[0][0].data.publishedAt).toBe(NOW);
  });

  it("is idempotent: an already decided order changes nothing and sends no email", async () => {
    findUniqueOrder.mockResolvedValue({ ...ORDER, status: "CONFIRMEE" });
    expect(await confirmListingFormulaOrder("o1", NOW, { kind: "provider" })).toBe("already_decided");
    expect(updateManyOrder).not.toHaveBeenCalled();
    expect(updateManyListing).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("loses the race gracefully when another writer confirmed between the read and the update", async () => {
    updateManyOrder.mockResolvedValue({ count: 0 });
    expect(await confirmListingFormulaOrder("o1", NOW, { kind: "provider" })).toBe("already_decided");
    expect(updateManyListing).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("never re-publishes a suspended listing: the order stays EN_ATTENTE, annotated for a human, no email", async () => {
    findUniqueOrder.mockResolvedValue({ ...ORDER, listing: { ...LISTING, status: "SUSPENDUE" } });
    expect(await confirmListingFormulaOrder("o1", NOW, { kind: "provider" })).toBe("listing_not_upgradable");
    expect(updateManyOrder).toHaveBeenCalledOnce();
    expect(updateManyOrder.mock.calls[0][0]).toEqual({ where: { id: "o1", status: { in: ["EN_ATTENTE", "ANNULEE"] } }, data: { reviewNote: "listing_not_upgradable:SUSPENDUE" } });
    expect(updateManyListing).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("rolls the confirmation back when the listing stops being upgradable between the read and the activation", async () => {
    updateManyListing.mockResolvedValue({ count: 0 }); // vendue entre-temps : le filtre de statut ne matche plus
    expect(await confirmListingFormulaOrder("o1", NOW, { kind: "provider" })).toBe("listing_not_upgradable");
    // La transaction a été rejetée (exception), puis la commande toujours EN_ATTENTE est annotée hors transaction.
    await expect($transaction.mock.results[0].value).rejects.toThrow("listing_not_upgradable");
    const last = updateManyOrder.mock.calls.at(-1)![0];
    expect(last).toEqual({ where: { id: "o1", status: { in: ["EN_ATTENTE", "ANNULEE"] } }, data: { reviewNote: "listing_not_upgradable:PUBLIEE" } });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("returns not_found for an unknown order", async () => {
    findUniqueOrder.mockResolvedValue(null);
    expect(await confirmListingFormulaOrder("nope", NOW, { kind: "provider" })).toBe("not_found");
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("fulfillListingFormulaOrderFromProvider is the provider-actor shortcut", async () => {
    expect(await fulfillListingFormulaOrderFromProvider("o1", NOW)).toBe("confirmed");
    expect(updateManyOrder.mock.calls[0][0].data.reviewedById).toBeNull();
  });
});

describe("confirmProSubscriptionOrder", () => {
  const PRO_ORDER = { id: "p1", status: "EN_ATTENTE", tier: "BUSINESS", provider: "VIREMENT", professionalAccountId: "acc-1", professionalAccount: { nomCommercial: "Auto Sara" }, user: USER };

  it("confirms, upserts the subscription for 30 days, and emails once", async () => {
    findUniqueProOrder.mockResolvedValue(PRO_ORDER);
    expect(await confirmProSubscriptionOrder("p1", NOW, { kind: "admin", adminId: "admin-1" })).toBe("confirmed");
    const upsert = upsertSubscription.mock.calls[0][0];
    expect(upsert.where).toEqual({ professionalAccountId: "acc-1" });
    expect(upsert.update.tier).toBe("BUSINESS");
    expect(upsert.update.expiresAt).toEqual(computeExpiryDate(NOW, 30));
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(sendEmail.mock.calls[0][0].html).toContain("subscriptionApprovedBody");
  });

  it("is idempotent on a decided order (CONFIRMEE or REJETEE)", async () => {
    findUniqueProOrder.mockResolvedValue({ ...PRO_ORDER, status: "REJETEE" });
    expect(await confirmProSubscriptionOrder("p1", NOW, { kind: "provider" })).toBe("already_decided");
    expect(upsertSubscription).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("still activates an ANNULEE order when the provider finally reports it paid (Lot 266, audit B2)", async () => {
    findUniqueProOrder.mockResolvedValue({ ...PRO_ORDER, status: "ANNULEE" });
    expect(await confirmProSubscriptionOrder("p1", NOW, { kind: "provider" })).toBe("confirmed");
    expect(updateManyProOrder.mock.calls[0][0].where).toEqual({ id: "p1", status: { in: ["EN_ATTENTE", "ANNULEE"] } });
    expect(upsertSubscription).toHaveBeenCalledOnce();
  });
});

describe("cancelPendingOrders*", () => {
  it("cancels only EN_ATTENTE orders of the listing, with a bounded note", async () => {
    updateManyOrder.mockResolvedValue({ count: 2 });
    expect(await cancelPendingOrdersForListing(asDb, "l1", "x".repeat(600), NOW)).toBe(2);
    const call = updateManyOrder.mock.calls[0][0];
    expect(call.where).toEqual({ listingId: "l1", status: "EN_ATTENTE" });
    expect(call.data.status).toBe("ANNULEE");
    expect(call.data.reviewNote).toHaveLength(500);
    expect(call.data.reviewedAt).toBe(NOW);
  });

  it("cancels both kinds of orders for a user", async () => {
    updateManyOrder.mockResolvedValue({ count: 1 });
    updateManyProOrder.mockResolvedValue({ count: 1 });
    expect(await cancelPendingOrdersForUser(asDb, "u1", "account_deleted", NOW)).toBe(2);
    expect(updateManyOrder.mock.calls[0][0].where).toEqual({ userId: "u1", status: "EN_ATTENTE" });
    expect(updateManyProOrder.mock.calls[0][0].where).toEqual({ userId: "u1", status: "EN_ATTENTE" });
  });
});
