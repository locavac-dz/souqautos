import { test, expect } from "@playwright/test";
import { uniqueAccount, registerAndLogin, loginAs, DEMO_SELLER_KARIM } from "./fixtures";

// Contacte un vendeur de démonstration réel (Karim Boudiaf, vendeur de la
// Renault Clio 2018 du seed) depuis un compte acheteur fraîchement inscrit,
// puis confirme que le message envoyé est bien visible côté vendeur — deux
// contextes navigateur distincts (cookies de session séparés), comme deux
// vrais utilisateurs.
test("un acheteur peut contacter un vendeur et le vendeur reçoit le message", async ({ browser }) => {
  const buyerContext = await browser.newContext();
  const buyerPage = await buyerContext.newPage();
  const buyer = uniqueAccount("buyer");
  await registerAndLogin(buyerPage, "fr", buyer);

  await buyerPage.goto("/fr/recherche?q=Renault+Clio+2018");
  await buyerPage.getByRole("link", { name: /Renault Clio 2018/i }).first().click();
  await expect(buyerPage).toHaveURL(/\/fr\/annonce\//);

  await buyerPage.getByRole("button", { name: "Contacter le vendeur" }).click();
  await expect(buyerPage).toHaveURL(/\/fr\/compte\/messages\//);

  const messageText = `Message de test E2E ${Date.now()}`;
  await buyerPage.getByRole("textbox", { name: "Écrire un message…" }).fill(messageText);
  await buyerPage.getByRole("button", { name: "Envoyer" }).click();
  await expect(buyerPage.getByText(messageText)).toBeVisible();

  const conversationUrl = buyerPage.url();

  const sellerContext = await browser.newContext();
  const sellerPage = await sellerContext.newPage();
  await loginAs(sellerPage, "fr", DEMO_SELLER_KARIM.email, DEMO_SELLER_KARIM.password);
  await sellerPage.goto(conversationUrl);
  await expect(sellerPage.getByText(messageText)).toBeVisible();

  await buyerContext.close();
  await sellerContext.close();
});
