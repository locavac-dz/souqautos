import { test, expect, type Browser, type Page } from "@playwright/test";
import { uniqueAccount, registerAndLogin } from "./fixtures";
import { createListing } from "./api-helpers";
import { disconnectE2eDb, e2eDb, userIdOf } from "./db";
import fr from "../messages/fr.json";
import ar from "../messages/ar.json";

// Lot 141 — les signaux de confiance d'un vendeur, dans un vrai navigateur, sur de VRAIES conversations : un acheteur écrit,
// le vendeur répond, et le badge de réactivité apparaît là où l'acheteur décide — sur la fiche de l'annonce.
//
// Le badge exige 5 conversations jugées et 80 % de réponses : les tests en créent donc réellement, par l'API (comme le fait le
// navigateur), puis reculent les dates en base pour simuler des délais. Reculer les dates est le SEUL artifice : tout le reste
// (envoi, réception, calcul, affichage) est le vrai code du site.
test.afterAll(disconnectE2eDb);
test.setTimeout(120_000);

const T = fr.SellerTrust;

// Un acheteur contacte l'annonce et écrit un message. Renvoie l'identifiant de la conversation.
async function buyerWrites(page: Page, listingId: string, text: string): Promise<string> {
  const created = await page.request.post("/api/conversations", { data: { listingId } });
  expect([200, 201], await created.text()).toContain(created.status());
  const conversationId = (await created.json()).conversation.id as string;
  const sent = await page.request.post(`/api/conversations/${conversationId}/messages`, { multipart: { content: text } });
  expect(sent.status(), await sent.text()).toBe(201);
  return conversationId;
}

async function sellerReplies(page: Page, conversationId: string, text: string) {
  const sent = await page.request.post(`/api/conversations/${conversationId}/messages`, { multipart: { content: text } });
  expect(sent.status(), await sent.text()).toBe(201);
}

// Recule dans le temps la conversation et ses messages, et fixe le délai de réponse du vendeur.
async function backdate(conversationId: string, buyerId: string, hoursAgo: number, replyMinutes: number | null) {
  const asked = new Date(Date.now() - hoursAgo * 3_600_000);
  await e2eDb().conversation.update({ where: { id: conversationId }, data: { createdAt: asked } });
  await e2eDb().message.updateMany({ where: { conversationId, senderId: buyerId }, data: { createdAt: asked } });
  if (replyMinutes === null) {
    await e2eDb().message.deleteMany({ where: { conversationId, senderId: { not: buyerId } } });
  } else {
    await e2eDb().message.updateMany({ where: { conversationId, senderId: { not: buyerId } }, data: { createdAt: new Date(asked.getTime() + replyMinutes * 60_000) } });
  }
}

// Construit un vendeur avec `count` conversations, répondues en `replyMinutes` (ou laissées sans réponse).
async function buildHistory(browser: Browser, sellerPage: Page, listingId: string, entries: (number | null)[]) {
  for (const [index, replyMinutes] of entries.entries()) {
    const buyerContext = await browser.newContext();
    const buyerPage = await buyerContext.newPage();
    const buyer = uniqueAccount(`trust-buyer-${index}`);
    await registerAndLogin(buyerPage, "fr", buyer);
    const conversationId = await buyerWrites(buyerPage, listingId, `Bonjour, l'annonce est-elle toujours disponible ? (${index})`);
    if (replyMinutes !== null) await sellerReplies(sellerPage, conversationId, "Oui, toujours disponible.");
    await backdate(conversationId, await userIdOf(buyer.email), 72 + index, replyMinutes);
    await buyerContext.close();
  }
}

test.describe("badge de réactivité du vendeur", () => {
  test("un vendeur qui répond vite obtient le badge, visible sur la fiche de l'annonce et sur sa page", async ({ page, browser }) => {
    const seller = uniqueAccount("trust-fast");
    await registerAndLogin(page, "fr", seller);
    const title = `Voiture du vendeur réactif ${Date.now()}`;
    const { id: listingId } = await createListing(page, { title });
    const cardOf = () => page.getByRole("link").filter({ hasText: title });

    // Aucun badge tant qu'il n'y a pas assez de conversations : on le vérifie AVANT, sinon le test ne prouverait rien.
    await page.goto(`/fr/annonce/${listingId}`);
    await expect(page.getByText(T.badgeUnder1h)).toHaveCount(0);
    await page.goto(`/fr/recherche?q=${encodeURIComponent(title)}`);
    await expect(cardOf().getByText(T.cardUnder1h)).toHaveCount(0);

    await buildHistory(browser, page, listingId, [10, 12, 15, 20, 25, 30]);

    await page.goto(`/fr/annonce/${listingId}`);
    await expect(page.getByText(T.badgeUnder1h)).toBeVisible();
    await page.goto(`/fr/vendeur/${await userIdOf(seller.email)}`);
    await expect(page.getByText(T.badgeUnder1h)).toBeVisible();

    // Lot 143 — le même badge, sous sa forme courte, sur la CARTE du résultat : sans ouvrir l'annonce. Français, puis arabe (RTL).
    await page.goto(`/fr/recherche?q=${encodeURIComponent(title)}`);
    await expect(cardOf().getByText(T.cardUnder1h)).toBeVisible();
    await page.goto(`/ar/recherche?q=${encodeURIComponent(title)}`);
    await expect(cardOf().getByText(ar.SellerTrust.cardUnder1h)).toBeVisible();
    // Et sur la page du modèle, qui affiche aussi des cartes : le badge n'est pas propre à la recherche.
    await page.goto("/fr/voitures/renault/clio");
    await expect(page.getByRole("link").filter({ hasText: title }).getByText(T.cardUnder1h)).toBeVisible();
  });

  test("un vendeur qui ne répond pas n'a AUCUN badge — et rien de négatif n'est affiché", async ({ page, browser }) => {
    const seller = uniqueAccount("trust-silent");
    await registerAndLogin(page, "fr", seller);
    const title = `Voiture du vendeur silencieux ${Date.now()}`;
    const { id: listingId } = await createListing(page, { title });
    await buildHistory(browser, page, listingId, [null, null, null, null, null, null]);

    // Sa carte non plus n'affiche aucun badge de réactivité — et rien de négatif à la place.
    await page.goto(`/fr/recherche?q=${encodeURIComponent(title)}`);
    const silentCard = page.getByRole("link").filter({ hasText: title });
    await expect(silentCard).toBeVisible();
    for (const badge of [T.cardUnder1h, T.cardUnder2h, T.cardUnder6h, T.cardUnder24h]) await expect(silentCard.getByText(badge)).toHaveCount(0);
    await expect(silentCard.getByRole("listitem")).toHaveCount(0); // aucune ligne de badges ajoutée à la carte

    await page.goto(`/fr/annonce/${listingId}`);
    for (const badge of [T.badgeUnder1h, T.badgeUnder2h, T.badgeUnder6h, T.badgeUnder24h]) {
      await expect(page.getByText(badge)).toHaveCount(0);
    }
    // Rien de négatif non plus. Les SEULES formulations négatives qui existent sont celles de l'espace du vendeur
    // (ses chiffres et ce qui lui manque) : aucune ne doit jamais atteindre une page d'acheteur.
    const body = await page.locator("body").innerText();
    for (const sellerOnly of [T.ownTitle, T.ownStats, T.ownNone, T.ownGapNotEnough, T.ownGapRateTooLow, T.ownGapTooSlow]) {
      expect(body, sellerOnly).not.toContain(sellerOnly.replace(/\{[a-z]+\}/gi, "").trim().slice(0, 30));
    }
  });

  test("le vendeur voit SES chiffres et ce qui lui manque, dans son espace", async ({ page, browser }) => {
    const seller = uniqueAccount("trust-own");
    await registerAndLogin(page, "fr", seller);
    const { id: listingId } = await createListing(page, { title: `Voiture ${Date.now()}` });

    await page.goto("/fr/compte/tableau-de-bord");
    await expect(page.getByRole("heading", { name: T.ownTitle })).toBeVisible();
    await expect(page.getByText(T.ownNone)).toBeVisible();
    await expect(page.getByText(T.ownGapNotEnough)).toBeVisible();

    // Trois conversations répondues, trois ignorées : 50 % — sous le seuil, donc pas de badge, et la raison est dite.
    await buildHistory(browser, page, listingId, [30, 30, 30, null, null, null]);
    await page.goto("/fr/compte/tableau-de-bord");
    await expect(page.getByText(T.ownGapRateTooLow)).toBeVisible();
    await expect(page.getByText("3 des 6 conversations", { exact: false })).toBeVisible();
    // L'acheteur, lui, ne voit toujours aucun badge.
    await page.goto(`/fr/annonce/${listingId}`);
    await expect(page.getByText(T.badgeUnder1h)).toHaveCount(0);
  });

  test("le badge « identité vérifiée » apparaît sur la fiche dès que l'équipe a validé la pièce", async ({ page }) => {
    const seller = uniqueAccount("trust-identity");
    await registerAndLogin(page, "fr", seller);
    const title = `Voiture identite ${Date.now()}`;
    const { id: listingId } = await createListing(page, { title });
    const search = `/fr/recherche?q=${encodeURIComponent(title)}`;
    const card = () => page.getByRole("link").filter({ hasText: title });

    await page.goto(`/fr/annonce/${listingId}`);
    await expect(page.getByText(T.identityVerified)).toHaveCount(0);
    await page.goto(search);
    await expect(card()).toBeVisible();
    await expect(card().getByText(T.identityVerified)).toHaveCount(0);

    await e2eDb().user.update({ where: { email: seller.email }, data: { identityVerifiedAt: new Date() } });
    await page.goto(`/fr/annonce/${listingId}`);
    await expect(page.getByText(T.identityVerified)).toBeVisible();
    // Lot 143 — et sur la carte du résultat (le résumé de confiance porte un drapeau explicite, pas seulement des points).
    await page.goto(search);
    await expect(card().getByText(T.identityVerified)).toBeVisible();
  });
});
