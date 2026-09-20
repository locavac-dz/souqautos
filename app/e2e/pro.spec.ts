import { test, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { uniqueAccount, registerAndLogin } from "./fixtures";
import { createListing } from "./api-helpers";
import { disconnectE2eDb, e2eDb, setProSubscription, userIdOf } from "./db";
import fr from "../messages/fr.json";

// Lot 131 — les outils d'un vendeur professionnel, avec un vrai visiteur et un vrai acheteur : les statistiques (vues,
// numéros affichés, conversations) doivent être EXACTEMENT ce que la base a enregistré, le détail par annonce est réservé
// aux abonnements Pro et Premium, et le suivi des prospects (statut, note privée) n'est accessible qu'au vendeur.
// Une seule mise en scène pour tous les tests de ce fichier : ils s'exécutent dans l'ordre et se partagent ses données.
test.describe.configure({ mode: "serial" });
test.afterAll(disconnectE2eDb);

type Scene = {
  contexts: BrowserContext[];
  pro: { page: Page; userId: string; businessName: string };
  buyer: { page: Page; name: string };
  listing: { id: string; title: string; phone: string };
};
let scene: Scene;

async function newPage(browser: Browser, contexts: BrowserContext[]): Promise<Page> {
  const context = await browser.newContext();
  contexts.push(context);
  return context.newPage();
}

test.beforeAll(async ({ browser }) => {
  test.setTimeout(120_000);
  const contexts: BrowserContext[] = [];

  // 1. Le vendeur professionnel : compte, entreprise, une annonce publiée.
  const proPage = await newPage(browser, contexts);
  const proAccount = uniqueAccount("pro");
  await registerAndLogin(proPage, "fr", proAccount);
  const businessName = `Garage Test ${Date.now()}`;
  const created = await proPage.request.post("/api/pro/accounts", { data: { nomCommercial: businessName, wilayaId: 16 } });
  expect(created.status(), await created.text()).toBe(201);
  const userId = await userIdOf(proAccount.email);
  await setProSubscription(userId, "STARTER");
  const listing = await createListing(proPage, { title: `Renault Clio du garage ${Date.now()}` });

  // 2. Un visiteur anonyme qui regarde l'annonce et affiche le numéro.
  const visitorPage = await newPage(browser, contexts);
  await visitorPage.goto(`/fr/annonce/${listing.id}`);
  await visitorPage.getByRole("button", { name: "Afficher le numéro" }).click();
  await expect(visitorPage.getByRole("link", { name: `Appeler ${listing.phone}` })).toBeVisible();

  // 3. Un acheteur inscrit qui écrit au vendeur.
  const buyerPage = await newPage(browser, contexts);
  const buyerAccount = uniqueAccount("acheteur-pro");
  await registerAndLogin(buyerPage, "fr", buyerAccount);
  await buyerPage.goto(`/fr/annonce/${listing.id}`);
  await buyerPage.getByRole("button", { name: "Contacter le vendeur" }).click();
  await expect(buyerPage).toHaveURL(/\/fr\/compte\/messages\//);
  await buyerPage.getByRole("textbox", { name: "Écrire un message…" }).fill("Bonjour, ce véhicule est-il toujours disponible ?");
  await buyerPage.getByRole("button", { name: "Envoyer" }).click();
  await expect(buyerPage.getByText("ce véhicule est-il toujours disponible")).toBeVisible();

  scene = { contexts, pro: { page: proPage, userId, businessName }, buyer: { page: buyerPage, name: buyerAccount.displayName }, listing };
});

test.afterAll(async () => {
  await Promise.all(scene?.contexts.map((context) => context.close()) ?? []);
});

// La valeur affichée sous une étiquette de la grille de chiffres (« Vues », « Conversations »…).
async function tile(page: Page, label: string): Promise<string> {
  const text = await page.getByText(label, { exact: true }).first().locator("xpath=..").innerText();
  return text.replace(label, "").trim().split("\n")[0].trim();
}

test.describe("statistiques du compte professionnel", () => {
  test("les chiffres affichés sont exactement ceux que la base a enregistrés", async () => {
    const { page } = scene.pro;
    const db = e2eDb();
    const views = (await db.listingViewDay.aggregate({ where: { listingId: scene.listing.id }, _sum: { count: true } }))._sum.count ?? 0;
    const phoneReveals = await db.contactEvent.count({ where: { listingId: scene.listing.id, channel: "TELEPHONE" } });
    const conversations = await db.conversation.count({ where: { listingId: scene.listing.id } });

    // Les vues sont comptées après l'envoi de la page : laisser le temps à l'enregistrement de fin.
    expect(views).toBeGreaterThanOrEqual(2); // le visiteur et l'acheteur, jamais le vendeur
    expect(phoneReveals).toBe(1);
    expect(conversations).toBe(1);

    await page.goto("/fr/pro/statistiques");
    await expect(page.getByRole("heading", { level: 1, name: fr.ProStats.title })).toBeVisible();
    expect(await tile(page, fr.ProStats.statViews)).toBe(String(views));
    expect(await tile(page, fr.ProStats.statConversations)).toBe(String(conversations));
    // Contacts = numéros affichés + conversations démarrées.
    expect(await tile(page, fr.ProStats.statContacts)).toBe(String(phoneReveals + conversations));
    await expect(page.getByText("1 appels, 0 WhatsApp, 1 messages")).toBeVisible();
  });

  test("les visites du vendeur lui-même ne comptent pas dans ses statistiques", async () => {
    const { page } = scene.pro;
    const db = e2eDb();
    const before = (await db.listingViewDay.aggregate({ where: { listingId: scene.listing.id }, _sum: { count: true } }))._sum.count ?? 0;
    await page.goto(`/fr/annonce/${scene.listing.id}`);
    await page.reload();
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const after = (await db.listingViewDay.aggregate({ where: { listingId: scene.listing.id }, _sum: { count: true } }))._sum.count ?? 0;
    expect(after).toBe(before);
  });

  test("le détail par annonce est verrouillé au palier Starter, ouvert aux paliers Pro et Premium", async () => {
    const { page, userId } = scene.pro;

    await setProSubscription(userId, "STARTER");
    await page.goto("/fr/pro/statistiques");
    await expect(page.getByText(fr.ProStats.detailLocked)).toBeVisible();
    await expect(page.getByRole("table")).toHaveCount(0);
    await expect(page.getByRole("link", { name: fr.ProStats.detailLockedLink })).toBeVisible();

    for (const tier of ["PRO", "PREMIUM"] as const) {
      await setProSubscription(userId, tier);
      await page.goto("/fr/pro/statistiques");
      await expect(page.getByText(fr.ProStats.detailLocked), tier).toHaveCount(0);
      const row = page.getByRole("row").filter({ hasText: scene.listing.title });
      await expect(row, tier).toBeVisible();
      await expect(row.getByRole("link", { name: scene.listing.title })).toHaveAttribute("href", new RegExp(`/annonce/${scene.listing.id}`));
    }
  });

  test("la période se change par un lien, et l'écran s'affiche en arabe de droite à gauche", async () => {
    const { page } = scene.pro;
    await page.goto("/fr/pro/statistiques");
    await page.getByRole("link", { name: "7 jours" }).click();
    await expect(page).toHaveURL(/jours=7/);
    await expect(page.getByRole("link", { name: "7 jours" })).toHaveAttribute("aria-current", "true");

    await page.goto("/ar/pro/statistiques");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.setViewportSize({ width: 375, height: 812 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test("un compte sans espace professionnel est invité à en créer un, sans voir aucun chiffre", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await registerAndLogin(page, "fr", uniqueAccount("sans-pro"));
    await page.goto("/fr/pro/statistiques");
    await expect(page.getByText(fr.Pro.noAccountYet)).toBeVisible();
    await expect(page.getByText(fr.ProStats.statViews)).toHaveCount(0);
    await page.goto("/fr/pro/prospects");
    await expect(page.getByText(fr.Pro.noAccountYet)).toBeVisible();
    await context.close();

    const anonymous = await browser.newContext();
    const anonymousPage = await anonymous.newPage();
    await anonymousPage.goto("/fr/pro/statistiques");
    await expect(anonymousPage).toHaveURL(/\/fr\/connexion/);
    await anonymous.close();
  });
});

test.describe("suivi des prospects", () => {
  test("la personne qui a écrit apparaît comme prospect « Nouveau » qui attend une réponse", async () => {
    const { page } = scene.pro;
    await page.goto("/fr/pro/prospects");
    await expect(page.getByRole("heading", { level: 1, name: fr.ProProspects.title })).toBeVisible();
    const card = page.locator("ul > li").filter({ hasText: scene.buyer.name }).filter({ hasText: fr.ProProspects.awaitingReply }).last();
    await expect(card).toBeVisible();
    await expect(card).toContainText(scene.listing.title);
    await expect(card.getByLabel(fr.ProProspects.statusLabel)).toHaveValue("NOUVEAU");
    await expect(card.getByRole("link", { name: fr.ProProspects.openConversation })).toBeVisible();
  });

  test("le statut et la note privée sont enregistrés, et retrouvés après rechargement", async () => {
    const { page } = scene.pro;
    await page.goto("/fr/pro/prospects");
    const card = page.locator("ul > li").filter({ hasText: scene.buyer.name }).filter({ has: page.getByLabel(fr.ProProspects.statusLabel) }).last();

    await card.getByLabel(fr.ProProspects.statusLabel).selectOption("EN_NEGOCIATION");
    await expect(card.getByText(fr.ProProspects.saved)).toBeVisible();
    const note = "Rappeler jeudi, veut négocier à 1 700 000 DA";
    await card.getByLabel(fr.ProProspects.noteLabel).fill(note);
    await card.getByRole("button", { name: fr.ProProspects.saveNote }).click();
    await expect(card.getByText(fr.ProProspects.saved)).toBeVisible();

    const saved = await e2eDb().prospectFollowUp.findFirstOrThrow({ where: { conversation: { listingId: scene.listing.id } } });
    expect(saved.status).toBe("EN_NEGOCIATION");
    expect(saved.note).toBe(note);

    await page.reload();
    const reloaded = page.locator("ul > li").filter({ hasText: scene.buyer.name }).filter({ has: page.getByLabel(fr.ProProspects.statusLabel) }).last();
    await expect(reloaded.getByLabel(fr.ProProspects.statusLabel)).toHaveValue("EN_NEGOCIATION");
    await expect(reloaded.getByLabel(fr.ProProspects.noteLabel)).toHaveValue(note);

    // Le filtre par statut ne garde que les prospects de ce statut.
    await page.goto("/fr/pro/prospects?statut=GAGNE");
    await expect(page.getByText(fr.ProProspects.noResults)).toBeVisible();
    await page.goto("/fr/pro/prospects?statut=EN_NEGOCIATION");
    await expect(page.getByText(scene.buyer.name).first()).toBeVisible();
  });

  test("statut et note sont privés : l'acheteur ne peut ni les lire, ni les modifier", async () => {
    const conversation = await e2eDb().conversation.findFirstOrThrow({ where: { listingId: scene.listing.id } });
    const asBuyer = await scene.buyer.page.request.patch(`/api/pro/prospects/${conversation.id}`, { data: { status: "PERDU" } });
    expect(asBuyer.status()).toBe(404); // même réponse qu'une conversation inexistante : rien n'est révélé
    const unknown = await scene.buyer.page.request.patch(`/api/pro/prospects/conversation-inconnue`, { data: { status: "PERDU" } });
    expect(unknown.status()).toBe(404);
    expect((await e2eDb().prospectFollowUp.findFirstOrThrow({ where: { conversationId: conversation.id } })).status).toBe("EN_NEGOCIATION");

    // Corps invalides, refusés côté vendeur aussi.
    const invalid = scene.pro.page.request;
    expect((await invalid.patch(`/api/pro/prospects/${conversation.id}`, { data: { status: "INVENTE" } })).status()).toBe(400);
    expect((await invalid.patch(`/api/pro/prospects/${conversation.id}`, { data: {} })).status()).toBe(400);

    // Ni la note, ni le statut ne figurent dans ce que voit l'acheteur.
    await scene.buyer.page.goto(`/fr/compte/messages/${conversation.id}`);
    await expect(scene.buyer.page.getByText("veut négocier à 1 700 000 DA")).toHaveCount(0);
    await expect(scene.buyer.page.getByText(fr.ProProspects.statusEN_NEGOCIATION)).toHaveCount(0);
  });
});
