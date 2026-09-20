import { test, expect } from "@playwright/test";
import { uniqueAccount, registerAndLogin } from "./fixtures";
import { createListing } from "./api-helpers";
import { disconnectE2eDb, e2eDb } from "./db";
import fr from "../messages/fr.json";
import ar from "../messages/ar.json";

// Lot 131 — la fiche d'une annonce : ce qu'elle affiche, ce qu'elle ne révèle PAS (le numéro de téléphone n'est jamais dans
// la page), qui peut la voir (une annonce en attente de modération n'est visible que de son auteur), et les crédits des
// photos sous licence libre (obligation légale, jamais un lien dangereux).
test.afterAll(disconnectE2eDb);

test.describe("fiche d'une annonce", () => {
  test("affiche le titre, le prix, et des données structurées valides pour les moteurs de recherche", async ({ page }) => {
    await registerAndLogin(page, "fr", uniqueAccount("fiche"));
    const { id, title } = await createListing(page, { price: 1_234_000 });

    await page.context().clearCookies(); // un visiteur anonyme
    const response = await page.goto(`/fr/annonce/${id}`);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.locator("main, body").first()).toContainText(/1\D?234\D?000\s*DA/);
    await expect(page).toHaveTitle(new RegExp(title.slice(0, 20)));

    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    const parsed = blocks.map((text) => JSON.parse(text) as Record<string, unknown>); // du JSON valide, sinon les moteurs l'ignorent
    const vehicle = parsed.find((block) => block["@type"] === "Vehicle") as { name: string; offers: { price: number; priceCurrency: string } } | undefined;
    expect(vehicle, "données structurées « Vehicle » absentes").toBeDefined();
    expect(vehicle!.name).toBe(title);
    expect(vehicle!.offers).toMatchObject({ price: 1_234_000, priceCurrency: "DZD" });
    expect(parsed.some((block) => block["@type"] === "BreadcrumbList")).toBe(true);
  });

  test("une annonce en attente de modération n'est visible que de son auteur (404 pour tout autre)", async ({ browser, page }) => {
    const owner = uniqueAccount("auteur");
    await registerAndLogin(page, "fr", owner);
    const { id, title } = await createListing(page, { publish: false });

    // L'auteur la voit, avec son titre.
    const own = await page.goto(`/fr/annonce/${id}`);
    expect(own?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();

    // Un visiteur anonyme et un autre compte reçoivent la même réponse « introuvable » (on ne révèle pas son existence).
    const anonymous = await browser.newContext();
    const anonymousPage = await anonymous.newPage();
    expect((await anonymousPage.goto(`/fr/annonce/${id}`))?.status()).toBe(404);

    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await registerAndLogin(otherPage, "fr", uniqueAccount("autre"));
    expect((await otherPage.goto(`/fr/annonce/${id}`))?.status()).toBe(404);
    await expect(otherPage.getByText(title)).toHaveCount(0);

    await anonymous.close();
    await other.close();
  });
});

test.describe("révélation du numéro de téléphone", () => {
  test("le numéro n'est jamais dans la page : il n'apparaît qu'au clic, il est compté, et il est limité en débit", async ({ browser, page, request }) => {
    await registerAndLogin(page, "fr", uniqueAccount("vendeur"));
    const { id, phone } = await createListing(page);
    const digits = phone.slice(1); // 05XXXXXXXX → sans le zéro initial

    // Ni le numéro, ni sa forme internationale, ne sont dans le code de la page envoyée à un visiteur.
    const html = await (await request.get(`/fr/annonce/${id}`)).text();
    expect(html).not.toContain(phone);
    expect(html).not.toContain(`+213${digits}`);
    expect(html).not.toContain(`213${digits}`);

    const visitor = await browser.newContext();
    const visitorPage = await visitor.newPage();
    await visitorPage.goto(`/fr/annonce/${id}`);
    await expect(visitorPage.getByText(phone)).toHaveCount(0);
    await visitorPage.getByRole("button", { name: "Afficher le numéro" }).click();

    const call = visitorPage.getByRole("link", { name: `Appeler ${phone}` });
    await expect(call).toBeVisible();
    await expect(call).toHaveAttribute("href", `tel:+213${digits}`);

    // La révélation est comptée (statistiques du vendeur), une seule fois pour ce clic.
    expect(await e2eDb().contactEvent.count({ where: { listingId: id, channel: "TELEPHONE" } })).toBe(1);

    // Limite par annonce et par adresse (6 par heure pour un visiteur anonyme) : au-delà, le site refuse.
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const r = await visitorPage.request.post(`/api/listings/${id}/contact`, { data: { channel: "TELEPHONE", locale: "fr" } });
      statuses.push(r.status());
    }
    expect(statuses.slice(0, 5)).toEqual([200, 200, 200, 200, 200]);
    expect(statuses[5]).toBe(429);
    await visitor.close();
  });

  test("le contact refuse une annonce non publiée, une demande invalide, et le vendeur lui-même", async ({ browser, page }) => {
    await registerAndLogin(page, "fr", uniqueAccount("vendeur2"));
    const pending = await createListing(page, { publish: false });
    const live = await createListing(page);

    // Le vendeur ne se révèle pas son propre numéro.
    const own = await page.request.post(`/api/listings/${live.id}/contact`, { data: { channel: "TELEPHONE", locale: "fr" } });
    expect(own.status()).toBe(400);
    expect(await own.json()).toEqual({ error: "own_listing" });

    const visitor = await browser.newContext();
    const asVisitor = (path: string, data: unknown) => visitor.request.post(path, { data });
    // Annonce en attente : même réponse que pour une annonce inexistante, sans rien laisser deviner.
    expect((await asVisitor(`/api/listings/${pending.id}/contact`, { channel: "TELEPHONE", locale: "fr" })).status()).toBe(404);
    expect((await asVisitor(`/api/listings/identifiant-inconnu/contact`, { channel: "TELEPHONE", locale: "fr" })).status()).toBe(404);
    // Demandes invalides.
    expect((await asVisitor(`/api/listings/${live.id}/contact`, { channel: "FAX", locale: "fr" })).status()).toBe(400);
    expect((await asVisitor(`/api/listings/${live.id}/contact`, {})).status()).toBe(400);
    expect((await visitor.request.post(`/api/listings/${live.id}/contact`, { data: "pas du json", headers: { "content-type": "application/json" } })).status()).toBe(400);
    // Rien de tout cela n'a été compté comme une révélation.
    expect(await e2eDb().contactEvent.count({ where: { listingId: { in: [pending.id, live.id] } } })).toBe(0);
    await visitor.close();
  });
});

test.describe("crédits des photos sous licence libre", () => {
  const LICENSE_URL = "https://creativecommons.org/licenses/by-sa/4.0/";
  const SOURCE_URL = "https://commons.wikimedia.org/wiki/File:Exemple.jpg";

  async function firstDemoPhotos(count: number) {
    const listings = await e2eDb().listing.findMany({
      where: { status: "PUBLIEE", seller: { email: { endsWith: "@example.dz" }, NOT: { email: { startsWith: "e2e-" } } } },
      include: { photos: { orderBy: { position: "asc" }, take: 1 } },
      orderBy: { createdAt: "asc" },
      take: count,
    });
    return listings.map((l) => ({ listingId: l.id, photoId: l.photos[0].id }));
  }
  const clearCredits = (photoId: string) =>
    e2eDb().listingPhoto.update({ where: { id: photoId }, data: { creditAuthor: null, creditLicense: null, creditLicenseUrl: null, creditSourceUrl: null } });

  test("affiche l'auteur, la licence et la source, avec des liens sûrs, en français et en arabe", async ({ page }) => {
    const [{ listingId, photoId }] = await firstDemoPhotos(1);
    await e2eDb().listingPhoto.update({
      where: { id: photoId },
      data: { creditAuthor: "Auteur d'Exemple", creditLicense: "CC BY-SA 4.0", creditLicenseUrl: LICENSE_URL, creditSourceUrl: SOURCE_URL },
    });
    try {
      for (const [locale, messages] of [["fr", fr], ["ar", ar]] as const) {
        await page.goto(`/${locale}/annonce/${listingId}`);
        const credit = page.getByText(messages.Listing.photoBy, { exact: false }).locator("xpath=ancestor-or-self::p[1]");
        await expect(credit).toContainText("Auteur d'Exemple");
        await expect(page.getByText(messages.Listing.photoIllustrative)).toBeVisible();

        const licence = credit.getByRole("link", { name: "CC BY-SA 4.0" });
        await expect(licence).toHaveAttribute("href", LICENSE_URL);
        await expect(licence).toHaveAttribute("target", "_blank");
        await expect(licence).toHaveAttribute("rel", /noopener/);
        await expect(licence).toHaveAttribute("rel", /noreferrer/);

        const source = credit.getByRole("link", { name: messages.Listing.photoSource });
        await expect(source).toHaveAttribute("href", SOURCE_URL);
        await expect(source).toHaveAttribute("rel", /noopener/);
      }
    } finally {
      await clearCredits(photoId);
    }
  });

  test("un lien de crédit dangereux ou hors liste blanche n'est jamais publié, le texte du crédit reste affiché", async ({ page }) => {
    const [{ listingId, photoId }] = await firstDemoPhotos(1);
    await e2eDb().listingPhoto.update({
      where: { id: photoId },
      data: { creditAuthor: "Auteur Dangereux", creditLicense: "Licence inconnue", creditLicenseUrl: "javascript:alert(document.cookie)", creditSourceUrl: "http://site-pirate.example/photo" },
    });
    try {
      await page.goto(`/fr/annonce/${listingId}`);
      const credit = page.getByText("Auteur Dangereux").locator("xpath=ancestor-or-self::p[1]");
      await expect(credit).toContainText("Licence inconnue");
      await expect(credit.locator("a")).toHaveCount(0); // ni la licence, ni la source ne sont des liens
      expect(await page.content()).not.toContain("javascript:alert");
      expect(await page.content()).not.toContain("site-pirate.example");
    } finally {
      await clearCredits(photoId);
    }
  });

  test("une photo envoyée par un vendeur n'affiche aucun crédit ni la mention « photo d'illustration »", async ({ page }) => {
    await registerAndLogin(page, "fr", uniqueAccount("credit"));
    const { id } = await createListing(page);
    await page.goto(`/fr/annonce/${id}`);
    await expect(page.getByText(fr.Listing.photoIllustrative)).toHaveCount(0);
    await expect(page.getByText(fr.Listing.photoBy)).toHaveCount(0);
  });
});
