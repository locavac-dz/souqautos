import { existsSync, mkdirSync, mkdtempSync, rmSync, rmdirSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import { createListing } from "../e2e/api-helpers";
import { disconnectE2eDb, e2eDb } from "../e2e/db";
import { hashPassword } from "../src/lib/auth-server/password";

// Lot 147 — les photos envoyées, sur la VERSION DE PRODUCTION (compilée, servie par `next start`). Le serveur de développement des tests de
// bout en bout sert les fichiers de `public/` À LA VOLÉE ; la version de production, elle, ne sert que ceux qui EXISTAIENT au démarrage.
// Une photo envoyée après le démarrage répondait donc 404 jusqu'au redémarrage suivant : sur un vrai serveur, chaque photo d'annonce
// aurait été cassée. Aucun test ne le voyait — aucun test de production n'envoyait de photo.
test.afterAll(disconnectE2eDb);
test.setTimeout(90_000);

const PASSWORD = "MotDePasseVendeur2026!";
const randomIp = () => `10.${1 + Math.floor(Math.random() * 253)}.${1 + Math.floor(Math.random() * 253)}.${1 + Math.floor(Math.random() * 253)}`;

async function loggedInSeller(page: Page) {
  const email = `pwa-photo-${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}@example.dz`;
  await e2eDb().user.create({ data: { email, passwordHash: await hashPassword(PASSWORD), emailVerifiedAt: new Date(), profile: { create: { displayName: "Vendeur de test des photos" } } } });
  const response = await page.request.post("/api/auth/login", { data: { email, password: PASSWORD }, headers: { "x-forwarded-for": randomIp() } });
  expect(response.status()).toBe(200);
  return email;
}

test.describe("photos envoyées, en production", () => {
  test("une photo envoyée APRÈS le démarrage du serveur est servie, directement et par l'optimiseur d'images", async ({ page, request }) => {
    await loggedInSeller(page);
    const { id } = await createListing(page);

    const photo = await e2eDb().listingPhoto.findFirstOrThrow({ where: { listingId: id }, select: { path: true } });
    expect(photo.path).toMatch(/^\/uploads\/listings\/[0-9a-f-]+\.jpg$/); // stockage disque local (S3 vidé pour ces tests)

    // Le fichier est bien là, et n'est PAS servi par l'application : c'est le défaut.
    const direct = await request.get(photo.path);
    expect(direct.status(), "la photo envoyée doit être servie").toBe(200);
    expect(direct.headers()["content-type"]).toBe("image/jpeg");
    expect((await direct.body()).length).toBeGreaterThan(1000);
    // Jamais une réécriture possible : nom aléatoire, donc cache d'un an (Lot 135).
    expect(direct.headers()["cache-control"]).toContain("immutable");
    expect(direct.headers()["x-content-type-options"]).toBe("nosniff");

    // L'optimiseur d'images (celui qu'utilise toute carte d'annonce) doit pouvoir la redimensionner.
    const optimized = await request.get(`/_next/image?url=${encodeURIComponent(photo.path)}&w=640&q=75`);
    expect(optimized.status(), "l'optimiseur d'images doit pouvoir lire la photo").toBe(200);
    expect(optimized.headers()["content-type"]).toMatch(/^image\//);
  });

  test("la fiche d'annonce affiche la photo : l'image se charge réellement dans le navigateur", async ({ page }) => {
    await loggedInSeller(page);
    const { id } = await createListing(page);
    await page.goto(`/fr/annonce/${id}`);
    const image = page.locator("main img[src*='uploads'], main img[src*='_next%2Fimage'], main img[src*='%2Fuploads%2F']").first();
    await expect(image).toBeVisible();
    // « complete » et une largeur réelle : le navigateur a chargé l'image (une photo cassée a une largeur naturelle de 0).
    await expect.poll(async () => image.evaluate((el: HTMLImageElement) => (el.complete ? el.naturalWidth : -1)), { timeout: 15_000 }).toBeGreaterThan(0);
  });
});

// La route qui sert ces photos (src/app/uploads/[...path]/route.ts) lit des fichiers du disque à partir d'une adresse : chaque piège classique
// est posé ICI, sur la version de production, où elle est réellement sollicitée (un fichier présent au démarrage est servi par Next.js
// lui-même ; c'est celui ajouté ensuite qui passe par la route). Les fichiers sont déposés dans le vrai dossier des photos, puis retirés.
const UPLOADS = path.resolve(__dirname, "..", "public", "uploads");

test.describe("la route des photos ne sert que des photos", () => {
  const created: string[] = [];
  const tag = `probe-${Date.now().toString(36)}`;
  const put = (relative: string, content: Buffer | string) => {
    const file = path.join(UPLOADS, relative);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, content);
    created.push(file);
    return file;
  };
  test.afterAll(() => {
    for (const file of created.reverse()) rmSync(file, { recursive: true, force: true });
    rmSync(path.join(UPLOADS, `dossier-${tag}`), { recursive: true, force: true });
  });

  test("sert une photo ajoutée après le démarrage, avec les bons en-têtes, et répond 304 à un navigateur qui la possède déjà", async ({ request }) => {
    const jpeg = await sharp({ create: { width: 64, height: 48, channels: 3, background: { r: 10, g: 120, b: 200 } } }).jpeg().toBuffer();
    put(`listings/${tag}.jpg`, jpeg);
    const url = `/uploads/listings/${tag}.jpg`;

    const response = await request.get(url);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("image/jpeg");
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
    expect(response.headers()["cache-control"]).toBe("public, max-age=31536000, immutable");
    expect(response.headers()["content-length"]).toBe(String(jpeg.length));
    expect((await response.body()).equals(jpeg)).toBe(true); // octet pour octet

    const etag = response.headers()["etag"];
    expect(etag).toMatch(/^"[0-9a-f]+-[0-9a-f]+"$/);
    const revalidated = await request.get(url, { headers: { "If-None-Match": etag } });
    expect(revalidated.status(), "304 quand le navigateur a déjà la photo").toBe(304);
    expect((await revalidated.body()).length).toBe(0);
    expect((await request.get(url, { headers: { "If-None-Match": '"autre"' } })).status()).toBe(200);

    const head = await request.head(url);
    expect(head.status()).toBe(200);
    expect(head.headers()["content-type"]).toBe("image/jpeg");
  });

  test("refuse tout ce qui n'est pas une image : script, page, vecteur, texte — même déposé dans le bon dossier", async ({ request }) => {
    const secret = "CONTENU-QUI-NE-DOIT-JAMAIS-ETRE-SERVI";
    for (const ext of ["svg", "html", "htm", "js", "txt", "json", "php"]) put(`listings/${tag}.${ext}`, secret);
    for (const ext of ["svg", "html", "htm", "js", "txt", "json", "php"]) {
      const response = await request.get(`/uploads/listings/${tag}.${ext}`);
      expect(response.status(), ext).toBe(404);
      expect(await response.text(), ext).not.toContain(secret);
    }
  });

  test("refuse un fichier caché, un nom à deux points, et un dossier que le site n'écrit pas (pièces d'identité, sauvegardes…)", async ({ request }) => {
    const jpeg = await sharp({ create: { width: 8, height: 8, channels: 3, background: { r: 1, g: 2, b: 3 } } }).jpeg().toBuffer();
    put(`listings/.cache-${tag}.jpg`, jpeg);
    put(`listings/a..b-${tag}.jpg`, jpeg);
    put(`dossier-${tag}/photo.jpg`, jpeg); // une vraie photo, dans un dossier qui ne fait pas partie de ceux que le site écrit
    expect((await request.get(`/uploads/listings/.cache-${tag}.jpg`)).status(), "fichier caché").toBe(404);
    expect((await request.get(`/uploads/listings/a..b-${tag}.jpg`)).status(), "deux points").toBe(404);
    expect((await request.get(`/uploads/dossier-${tag}/photo.jpg`)).status(), "dossier hors liste").toBe(404);
    for (const forbidden of ["identity", "identity-uploads", "private", "backups"]) expect((await request.get(`/uploads/${forbidden}/x.jpg`)).status(), forbidden).toBe(404);
  });

  test("ne remonte jamais hors du dossier des photos, quelle que soit la forme de la remontée, et ne liste jamais un dossier", async ({ request }) => {
    for (const url of [
      "/uploads/listings/..%2f..%2f..%2f.env",
      "/uploads/listings/%2e%2e/%2e%2e/.env",
      "/uploads/listings/..%5c..%5c.env",
      "/uploads/../.env",
      "/uploads/..%2f.env",
      "/uploads/listings/....//....//.env",
      "/uploads/listings/%00.jpg",
      "/uploads/listings/a.jpg%00.txt",
    ]) {
      const response = await request.get(url);
      const body = await response.text();
      expect([400, 404], url).toContain(response.status());
      expect(body, url).not.toMatch(/DATABASE_URL|JWT_SECRET|ENCRYPTION_KEY/);
    }
    for (const url of ["/uploads", "/uploads/", "/uploads/listings", "/uploads/listings/"]) {
      const response = await request.get(url, { maxRedirects: 0 });
      expect([404, 307, 308], url).toContain(response.status()); // jamais 200 : aucune liste de fichiers
      if (response.status() === 200) throw new Error(`${url} ne doit pas être servi`);
    }
  });

  test("un dossier qui n'est qu'un lien vers l'extérieur (lien symbolique, jonction) ne fait pas sortir du dossier des photos", async ({ request }) => {
    // Un lien vers un FICHIER exige un privilège que Windows refuse ; un lien vers un DOSSIER (jonction) non, et se comporte comme un lien
    // symbolique sous Linux. On en pose un à la place d'un dossier que le site écrit et qui n'existe pas encore ici.
    const link = path.join(UPLOADS, "pro-banners");
    if (existsSync(link)) {
      test.skip(true, "le dossier « pro-banners » existe déjà ici : on n'y touche pas");
      return;
    }
    const outside = mkdtempSync(path.join(os.tmpdir(), "hors-dossier-"));
    const jpeg = await sharp({ create: { width: 8, height: 8, channels: 3, background: { r: 9, g: 9, b: 9 } } }).jpeg().toBuffer();
    writeFileSync(path.join(outside, "hors.jpg"), jpeg); // une VRAIE image, hors du dossier : si la garde tombait, elle serait servie
    try {
      symlinkSync(outside, link, "junction");
      // Contrôle : le lien fonctionne bien (le fichier est joignable PAR le chemin du lien) — sinon le refus ci-dessous ne prouverait rien.
      expect(existsSync(path.join(link, "hors.jpg")), "le lien pointe bien vers le fichier extérieur").toBe(true);
      expect((await request.get("/uploads/pro-banners/hors.jpg")).status(), "sortie du dossier par un lien").toBe(404);
    } finally {
      try {
        rmdirSync(link); // une jonction se retire comme un dossier vide, sans toucher à sa cible
      } catch {
        unlinkSync(link); // un lien symbolique (Linux) se retire par unlink
      }
      expect(existsSync(path.join(outside, "hors.jpg")), "la cible n'a pas été touchée").toBe(true);
      rmSync(outside, { recursive: true, force: true });
    }
  });
});
