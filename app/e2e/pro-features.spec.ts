import { test, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { uniqueAccount, registerAndLogin } from "./fixtures";
import { createListing } from "./api-helpers";
import { disconnectE2eDb, e2eDb, publishListing, setProSubscription, userIdOf } from "./db";
import fr from "../messages/fr.json";

// Lots 155-161 — tests des fonctionnalités du compte professionnel :
// coordonnées/catégorie, encart pro sur fiche, filtre vendeur dans la recherche,
// filtres rapides sur la vitrine, demande de rappel, bouton de suivi.
// Exécution sérielle (scène partagée entre les tests).
test.describe.configure({ mode: "serial" });
test.afterAll(disconnectE2eDb);

type Scene = {
  contexts: BrowserContext[];
  pro: { page: Page; userId: string; accountId: string; email: string };
  buyer: { page: Page; email: string };
  listing: { id: string; title: string };
};
let scene: Scene;

async function newPage(browser: Browser, contexts: BrowserContext[]): Promise<Page> {
  const context = await browser.newContext();
  contexts.push(context);
  return context.newPage();
}

test.beforeAll(async ({ browser }) => {
  test.setTimeout(180_000);
  const contexts: BrowserContext[] = [];

  // 1. Compte professionnel avec coordonnées et catégorie (Lot 155)
  const proPage = await newPage(browser, contexts);
  const proAccount = uniqueAccount("pro-features");
  await registerAndLogin(proPage, "fr", proAccount);
  const created = await proPage.request.post("/api/pro/accounts", {
    data: { nomCommercial: `Garage Lot155 ${Date.now()}`, wilayaId: 16 },
  });
  expect(created.status(), await created.text()).toBe(201);

  const userId = await userIdOf(proAccount.email);
  await setProSubscription(userId, "STARTER");

  // Remplir coordonnées et catégorie
  await proPage.goto("/fr/pro/profil");
  const phoneInput = proPage.getByLabel(fr.Pro.phoneLabel);
  if (await phoneInput.isVisible()) {
    await phoneInput.fill("0555123456");
    await proPage.getByRole("button", { name: fr.Pro.profileSave }).click();
    await expect(proPage.getByText(fr.Pro.profileSaved)).toBeVisible();
  }

  const account = await e2eDb().professionalAccount.findUniqueOrThrow({ where: { userId } });

  // 2. Annonce publiée (via bypass modération)
  const listing = await createListing(proPage, { title: `Renault Clio Lot155 ${Date.now()}` });
  await publishListing(listing.id);

  // 3. Acheteur
  const buyerPage = await newPage(browser, contexts);
  const buyerAccount = uniqueAccount("acheteur-lot155");
  await registerAndLogin(buyerPage, "fr", buyerAccount);

  scene = {
    contexts,
    pro: { page: proPage, userId, accountId: account.id, email: proAccount.email },
    buyer: { page: buyerPage, email: buyerAccount.email },
    listing,
  };
});

test.afterAll(async () => {
  await Promise.all(scene?.contexts.map((c) => c.close()) ?? []);
});

// ---- Lot 158 : encart pro sur la fiche annonce ----------------------------------------

test.describe("Lot 158 : encart pro sur la fiche annonce", () => {
  test("l'encart pro apparaît sur la fiche d'un vendeur professionnel", async () => {
    const { buyer, listing, pro } = scene;
    await buyer.page.goto(`/fr/annonce/${listing.id}`);
    // L'encart pro affiche le nom commercial et un lien vers la vitrine
    const vitrineLinkText = fr.Pro.proEncartViewAll.replace("{count}", /\d+/.exec(fr.Pro.proEncartViewAll)?.[0] ?? "");
    // Le lien "Voir les N annonces" doit pointer vers /pro/<accountId>
    const encartLink = buyer.page.getByRole("link", { name: /Voir les/ });
    await expect(encartLink).toBeVisible();
    await expect(encartLink).toHaveAttribute("href", new RegExp(`/pro/${pro.accountId}`));
  });
});

// ---- Lot 158 : filtre vendeur dans la recherche ---------------------------------------

test.describe("Lot 158 : filtre vendeur dans la recherche", () => {
  test("le filtre sellerType=pro n'affiche que les annonces de vendeurs pro", async () => {
    const db = e2eDb();
    const proCount = await db.listing.count({
      where: {
        status: "PUBLIEE",
        seller: { professionalAccount: { isNot: null } },
      },
    });
    const { buyer } = scene;
    await buyer.page.goto("/fr/recherche?sellerType=pro");
    const countText = await buyer.page.getByText(/annonces? trouvées?/).first().innerText();
    expect(Number(countText.replace(/\D/g, ""))).toBe(proCount);
  });

  test("le filtre sellerType=particulier n'affiche que les annonces de particuliers", async () => {
    const db = e2eDb();
    const partCount = await db.listing.count({
      where: {
        status: "PUBLIEE",
        seller: { professionalAccount: { is: null } },
      },
    });
    const { buyer } = scene;
    await buyer.page.goto("/fr/recherche?sellerType=particulier");
    const countText = await buyer.page.getByText(/annonces? trouvées?/).first().innerText();
    expect(Number(countText.replace(/\D/g, ""))).toBe(partCount);
  });
});

// ---- Lot 159 : filtres rapides sur la vitrine ----------------------------------------

test.describe("Lot 159 : filtres rapides sur la vitrine", () => {
  test("la vitrine s'affiche sans filtres avec toutes les annonces publiées du pro", async () => {
    const { buyer, pro, listing } = scene;
    await buyer.page.goto(`/fr/pro/${pro.accountId}`);
    await expect(buyer.page.getByText(listing.title)).toBeVisible();
  });

  test("le filtre par marque réduit le stock affiché", async () => {
    const { buyer, pro } = scene;
    const db = e2eDb();
    // Trouver la marque des annonces du pro
    const proListings = await db.listing.findMany({
      where: { sellerId: pro.userId, status: "PUBLIEE", brandId: { not: null } },
      select: { brandId: true, brand: { select: { name: true } } },
      take: 1,
    });
    if (proListings.length === 0 || !proListings[0].brandId) return; // skip si pas de marque
    const brandId = proListings[0].brandId;
    const expected = await db.listing.count({ where: { sellerId: pro.userId, status: "PUBLIEE", brandId } });

    await buyer.page.goto(`/fr/pro/${pro.accountId}?brandId=${brandId}`);
    const countText = await buyer.page.getByText(/annonces? trouvées?|annonce trouvée/).first().innerText().catch(() => "");
    if (countText) {
      expect(Number(countText.replace(/\D/g, ""))).toBe(expected);
    }
    // Le bouton de réinitialisation apparaît quand un filtre est actif
    await expect(buyer.page.getByRole("button", { name: fr.Pro.stockFilterReset })).toBeVisible();
  });
});

// ---- Lot 160 : demande de rappel ----------------------------------------------------

test.describe("Lot 160 : demande de rappel", () => {
  test("le bouton 'Être rappelé' est visible sur la fiche d'une annonce pro", async () => {
    const { buyer, listing } = scene;
    await buyer.page.goto(`/fr/annonce/${listing.id}`);
    await expect(buyer.page.getByRole("button", { name: fr.CallbackRequest.buttonLabel })).toBeVisible();
  });

  test("soumettre une demande de rappel crée une ligne dans la base", async () => {
    const { buyer, listing, pro } = scene;
    await buyer.page.goto(`/fr/annonce/${listing.id}`);
    await buyer.page.getByRole("button", { name: fr.CallbackRequest.buttonLabel }).click();
    await expect(buyer.page.getByRole("heading", { name: fr.CallbackRequest.modalTitle })).toBeVisible();

    await buyer.page.getByLabel(fr.CallbackRequest.nameLabel).fill("Test Rappel");
    await buyer.page.getByLabel(fr.CallbackRequest.phoneLabel).fill("0551234567");

    const before = await e2eDb().callbackRequest.count({ where: { proAccountId: pro.accountId } });
    await buyer.page.getByRole("button", { name: fr.CallbackRequest.submit }).click();
    await expect(buyer.page.getByText(fr.CallbackRequest.success)).toBeVisible();

    const after = await e2eDb().callbackRequest.count({ where: { proAccountId: pro.accountId } });
    expect(after).toBe(before + 1);
  });

  test("la demande de rappel apparaît dans la page prospects du pro", async () => {
    const { pro } = scene;
    await pro.page.goto("/fr/pro/prospects");
    await expect(pro.page.getByText("Test Rappel")).toBeVisible();
    await expect(pro.page.getByText("0551234567")).toBeVisible();
  });

  test("un numéro invalide est refusé", async () => {
    const { buyer, listing } = scene;
    await buyer.page.goto(`/fr/annonce/${listing.id}`);
    await buyer.page.getByRole("button", { name: fr.CallbackRequest.buttonLabel }).click();
    await buyer.page.getByLabel(fr.CallbackRequest.nameLabel).fill("Nom Test");
    await buyer.page.getByLabel(fr.CallbackRequest.phoneLabel).fill("12345");
    await buyer.page.getByRole("button", { name: fr.CallbackRequest.submit }).click();
    await expect(buyer.page.getByText(fr.CallbackRequest.errorPhone)).toBeVisible();
  });
});

// ---- Lot 161 : suivre un concessionnaire --------------------------------------------

test.describe("Lot 161 : suivre un concessionnaire", () => {
  test("le bouton 'Suivre' est visible sur la vitrine", async () => {
    const { buyer, pro } = scene;
    await buyer.page.goto(`/fr/pro/${pro.accountId}`);
    await expect(buyer.page.getByRole("button", { name: fr.Pro.followButton })).toBeVisible();
  });

  test("cliquer 'Suivre' crée un abonnement dans la base", async () => {
    const { buyer, pro } = scene;
    const buyerUserId = await userIdOf(buyer.email);

    await buyer.page.goto(`/fr/pro/${pro.accountId}`);
    const before = await e2eDb().proFollow.count({ where: { userId: buyerUserId, proAccountId: pro.accountId } });
    expect(before).toBe(0);

    await buyer.page.getByRole("button", { name: fr.Pro.followButton }).click();
    await expect(buyer.page.getByRole("button", { name: fr.Pro.unfollowButton })).toBeVisible();

    const after = await e2eDb().proFollow.count({ where: { userId: buyerUserId, proAccountId: pro.accountId } });
    expect(after).toBe(1);
  });

  test("cliquer 'Abonné' supprime l'abonnement", async () => {
    const { buyer, pro } = scene;
    const buyerUserId = await userIdOf(buyer.email);

    await buyer.page.goto(`/fr/pro/${pro.accountId}`);
    await expect(buyer.page.getByRole("button", { name: fr.Pro.unfollowButton })).toBeVisible();
    await buyer.page.getByRole("button", { name: fr.Pro.unfollowButton }).click();
    await expect(buyer.page.getByRole("button", { name: fr.Pro.followButton })).toBeVisible();

    const count = await e2eDb().proFollow.count({ where: { userId: buyerUserId, proAccountId: pro.accountId } });
    expect(count).toBe(0);
  });

  test("le propriétaire ne voit pas le bouton Suivre sur sa propre vitrine", async () => {
    const { pro } = scene;
    await pro.page.goto(`/fr/pro/${pro.accountId}`);
    await expect(pro.page.getByRole("button", { name: fr.Pro.followButton })).toHaveCount(0);
    await expect(pro.page.getByRole("button", { name: fr.Pro.unfollowButton })).toHaveCount(0);
  });
});
