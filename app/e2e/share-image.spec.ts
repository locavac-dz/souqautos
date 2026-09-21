import { test, expect, type APIResponse } from "@playwright/test";
import sharp from "sharp";
import { uniqueAccount, registerAndLogin } from "./fixtures";
import { createListing } from "./api-helpers";
import { disconnectE2eDb, e2eDb } from "./db";

// Lot 142 — l'image de partage d'une annonce (WhatsApp, Facebook, Messenger…), dans le vrai serveur : la fiche l'annonce bien dans
// ses balises, l'image est servie avec les bons en-têtes, elle suit les modifications, et elle ne fuit jamais une annonce non publiée.
test.afterAll(disconnectE2eDb);
test.setTimeout(120_000);

const IMAGE_MAX_BYTES = 300 * 1024; // repère courant au-delà duquel WhatsApp affiche mal l'aperçu

function meta(html: string, attribute: "property" | "name", key: string): string | null {
  const tag = html.match(new RegExp(`<meta ${attribute}="${key}" content="([^"]*)"`));
  return tag ? tag[1] : null;
}

// L'adresse de l'image vient de la fiche ; on ne garde que son chemin, le serveur de test n'ayant pas forcément l'adresse publique.
function pathOf(url: string): string {
  const { pathname, search } = new URL(url);
  return pathname + search;
}

async function bytesOf(response: APIResponse): Promise<Buffer> {
  expect(response.status(), await response.text().catch(() => "")).toBe(200);
  return Buffer.from(await response.body());
}

test.describe("image de partage d'une annonce", () => {
  test("la fiche annonce la carte de partage (et non plus la photo brute), avec ses dimensions", async ({ page }) => {
    await registerAndLogin(page, "fr", uniqueAccount("share-tags"));
    const { id } = await createListing(page);

    for (const locale of ["fr", "ar"]) {
      const html = await (await page.request.get(`/${locale}/annonce/${id}`)).text();
      const ogImage = meta(html, "property", "og:image");
      expect(ogImage, `og:image (${locale})`).toContain(`/${locale}/annonce/${id}/opengraph-image`);
      expect(ogImage, "la photo brute du vendeur ne doit plus être celle qu'on partage").not.toContain("/uploads/");
      expect(meta(html, "property", "og:image:width")).toBe("1200");
      expect(meta(html, "property", "og:image:height")).toBe("630");
      expect(meta(html, "property", "og:image:type")).toBe("image/jpeg");
      expect(meta(html, "property", "og:image:alt")).toBeTruthy();
      expect(meta(html, "name", "twitter:card")).toBe("summary_large_image");
      expect(meta(html, "name", "twitter:image")).toBe(ogImage);
    }
  });

  test("l'adresse annoncée sert bien un JPEG de 1200 × 630, léger, mis en cache, réellement dessiné", async ({ page }) => {
    await registerAndLogin(page, "fr", uniqueAccount("share-image"));
    const { id } = await createListing(page, { price: 2_450_000 });

    const html = await (await page.request.get(`/fr/annonce/${id}`)).text();
    const response = await page.request.get(pathOf(meta(html, "property", "og:image")!));
    const image = await bytesOf(response);

    expect(response.headers()["content-type"]).toBe("image/jpeg");
    expect(response.headers()["cache-control"]).toMatch(/public/);
    expect(response.headers()["cache-control"]).toMatch(/max-age=\d+/);
    expect(image.length).toBeLessThan(IMAGE_MAX_BYTES);
    const info = await sharp(image).metadata();
    expect({ format: info.format, width: info.width, height: info.height }).toEqual({ format: "jpeg", width: 1200, height: 630 });

    // Le bas de la carte porte le texte sur un dégradé sombre : il est nettement plus sombre que le haut de la photo de test.
    const bottom = await sharp(await sharp(image).extract({ left: 700, top: 420, width: 480, height: 190 }).toBuffer()).stats();
    const top = await sharp(await sharp(image).extract({ left: 700, top: 10, width: 480, height: 120 }).toBuffer()).stats();
    const mean = (s: typeof bottom) => (s.channels[0].mean + s.channels[1].mean + s.channels[2].mean) / 3;
    expect(mean(bottom)).toBeLessThan(mean(top));
  });

  test("une annonce publiée SANS photo a quand même une image de partage (avant ce lot : aucune)", async ({ page }) => {
    await registerAndLogin(page, "fr", uniqueAccount("share-nophoto"));
    const { id } = await createListing(page);
    await e2eDb().listingPhoto.deleteMany({ where: { listingId: id } });

    const html = await (await page.request.get(`/fr/annonce/${id}`)).text();
    const ogImage = meta(html, "property", "og:image");
    expect(ogImage, "og:image d'une annonce sans photo").toContain("/opengraph-image");

    const image = await bytesOf(await page.request.get(pathOf(ogImage!)));
    const info = await sharp(image).metadata();
    expect({ width: info.width, height: info.height }).toEqual({ width: 1200, height: 630 });
    const stats = await sharp(image).stats();
    expect(stats.channels[2].mean).toBeGreaterThan(stats.channels[0].mean); // fond en dégradé bleuté, pas une image vide
  });

  test("la carte suit l'annonce : un prix modifié donne une autre image, jamais une carte périmée", async ({ page }) => {
    await registerAndLogin(page, "fr", uniqueAccount("share-price"));
    const { id } = await createListing(page, { price: 1_000_000 });
    const url = `/fr/annonce/${id}/opengraph-image`;

    const before = await bytesOf(await page.request.get(url));
    expect((await bytesOf(await page.request.get(url))).equals(before)).toBe(true); // stable tant que rien ne change

    await e2eDb().listing.update({ where: { id }, data: { price: 9_999_000 } });
    const after = await bytesOf(await page.request.get(url));
    expect(after.equals(before)).toBe(false);
  });

  test("la carte est identique en français et en arabe (aucun texte arabe : la police n'en a pas)", async ({ page }) => {
    await registerAndLogin(page, "fr", uniqueAccount("share-locale"));
    const { id } = await createListing(page);
    const fr = await bytesOf(await page.request.get(`/fr/annonce/${id}/opengraph-image`));
    const ar = await bytesOf(await page.request.get(`/ar/annonce/${id}/opengraph-image`));
    expect(ar.equals(fr)).toBe(true);
  });

  test("REFUSE toute annonce non publiée : ni prix ni photo ne fuient par une adresse d'image devinée", async ({ page }) => {
    await registerAndLogin(page, "fr", uniqueAccount("share-private"));
    const { id } = await createListing(page, { price: 7_777_777 });
    const url = `/fr/annonce/${id}/opengraph-image`;

    expect((await page.request.get(url)).status(), "publiée : servie").toBe(200);
    for (const status of ["BROUILLON", "EN_ATTENTE", "SUSPENDUE", "REFUSEE", "VENDUE", "EXPIREE"] as const) {
      await e2eDb().listing.update({ where: { id }, data: { status } });
      const response = await page.request.get(url);
      expect(response.status(), status).toBe(404);
      expect((response.headers()["content-type"] ?? "").startsWith("image/"), `${status} ne doit pas renvoyer d'image`).toBe(false);
    }
    // Contrôle : le refus vient bien du statut. Republiée, la même adresse sert de nouveau la carte.
    await e2eDb().listing.update({ where: { id }, data: { status: "PUBLIEE" } });
    expect((await page.request.get(url)).status()).toBe(200);
  });

  test("la fiche d'un brouillon ne livre aucune image (Next ajoute la balise, l'adresse répond 404), et une annonce inconnue répond 404 sans erreur serveur", async ({ page }) => {
    await registerAndLogin(page, "fr", uniqueAccount("share-draft"));
    const { id } = await createListing(page, { publish: false });

    // Next ajoute la balise og:image de la convention de fichier même quand `generateMetadata` ne renvoie rien : pour un brouillon,
    // elle pointe donc vers une adresse qui répond 404 — l'aperçu est vide, rien n'est divulgué.
    const html = await (await page.request.get(`/fr/annonce/${id}`)).text();
    const advertised = meta(html, "property", "og:image");
    if (advertised !== null) expect((await page.request.get(pathOf(advertised))).status()).toBe(404);
    expect((await page.request.get(`/fr/annonce/${id}/opengraph-image`)).status()).toBe(404);

    for (const bogus of ["inexistant", "x".repeat(200), "%2e%2e%2f%2e%2e%2fetc%2fpasswd", "'; DROP TABLE \"Listing\";--"]) {
      const status = (await page.request.get(`/fr/annonce/${encodeURIComponent(bogus)}/opengraph-image`)).status();
      expect(status, bogus).toBe(404);
    }
  });
});
