import { test, expect, type ConsoleMessage } from "@playwright/test";
import { disconnectE2eDb } from "./db";
import { STATIC_PATHS, dynamicPaths } from "./public-paths";

// Lot 131 — chaque page publique, dans les deux langues, sur le vrai site : elle répond, porte la bonne langue et le
// bon sens d'écriture (droite à gauche en arabe), a un titre, ne déclenche aucune erreur dans le navigateur
// (exception non attrapée, erreur d'hydratation, requête du site en échec) et ne déborde pas de l'écran d'un
// téléphone. Aucun de ces défauts n'est visible dans un test unitaire.
test.afterAll(disconnectE2eDb);
test.setTimeout(60_000);

// Bruit propre au mode développement, sans rapport avec le site (outil de développement, image d'illustration absente).
function isRealError(message: ConsoleMessage): boolean {
  if (message.type() !== "error") return false;
  const text = message.text();
  return !/Download the React DevTools|favicon|Failed to load resource: the server responded with a status of 404/i.test(text);
}

for (const locale of ["fr", "ar"] as const) {
  test.describe(`pages publiques en ${locale === "fr" ? "français" : "arabe"}`, () => {
    let paths: string[] = [];
    test.beforeAll(async () => {
      paths = [...STATIC_PATHS, ...(await dynamicPaths())];
    });

    test("chaque page répond, dans la bonne langue et le bon sens, sans erreur, sans débordement sur téléphone", async ({ page }) => {
      test.setTimeout(300_000);
      const problems: string[] = [];
      let current = "";
      page.on("pageerror", (error) => problems.push(`${current} : exception ${error.message}`));
      page.on("console", (message) => {
        if (isRealError(message)) problems.push(`${current} : console.error ${message.text().slice(0, 160)}`);
      });
      page.on("response", (response) => {
        const url = new URL(response.url());
        if (url.origin === new URL(page.url() || "http://localhost:5185").origin && response.status() >= 500) {
          problems.push(`${current} : ${response.status()} sur ${url.pathname}`);
        }
      });

      for (const path of paths) {
        current = `/${locale}${path}`;
        const response = await page.goto(current, { waitUntil: "load" });
        if (response?.status() !== 200) problems.push(`${current} : statut ${response?.status()}`);

        await page.setViewportSize({ width: 1280, height: 800 });
        const html = page.locator("html");
        if ((await html.getAttribute("lang")) !== locale) problems.push(`${current} : lang=${await html.getAttribute("lang")}`);
        const expectedDir = locale === "ar" ? "rtl" : "ltr";
        if ((await html.getAttribute("dir")) !== expectedDir) problems.push(`${current} : dir=${await html.getAttribute("dir")}`);
        if ((await page.locator("h1").count()) === 0) problems.push(`${current} : aucun titre h1`);
        if (!(await page.title()).trim()) problems.push(`${current} : titre de page vide`);

        // Téléphone : la page ne doit pas déborder horizontalement (défaut rencontré au Lot 127).
        await page.setViewportSize({ width: 375, height: 812 });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        if (overflow > 0) problems.push(`${current} : déborde de ${overflow}px sur 375px`);
      }

      expect(problems).toEqual([]);
    });
  });
}

test("le sélecteur de langue passe de la version française à la version arabe (et inversement), sur la même page", async ({ page }) => {
  await page.goto("/fr/guides");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await page.getByRole("button", { name: "AR" }).click();
  await expect(page).toHaveURL(/\/ar\/guides/);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.getByRole("button", { name: "FR" }).click();
  await expect(page).toHaveURL(/\/fr\/guides/);
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
});

test("une adresse sans langue redirige vers le français", async ({ page }) => {
  await page.goto("/recherche");
  await expect(page).toHaveURL(/\/fr\/recherche/);
});

// Lot 131 — avant ce lot, une annonce ou un profil inexistant répondait 200 (page « introuvable » que les moteurs de
// recherche gardent) et toute autre adresse inconnue affichait la page anglaise par défaut de Next.js, même en arabe.
test.describe("pages introuvables", () => {
  const UNKNOWN = [
    ["/fr/annonce/identifiant-qui-nexiste-pas", "une annonce inexistante"],
    ["/fr/vendeur/identifiant-qui-nexiste-pas", "un profil inexistant"],
    ["/fr/voitures/renault/modele-inconnu", "un modèle inconnu"],
    ["/fr/guides/guide-inconnu", "un guide inconnu"],
    ["/fr/cette-page-nexiste-pas", "une adresse qui ne correspond à aucune page"],
    ["/fr/un/chemin/plus/long/encore", "un long chemin inconnu"],
  ] as const;

  for (const [path, label] of UNKNOWN) {
    test(`${label} répond 404 avec une page traduite en français`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(404);
      await expect(page.locator("html")).toHaveAttribute("lang", "fr");
      await expect(page.getByRole("heading", { level: 1, name: "Page introuvable" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Retour à l'accueil" })).toBeVisible();
      await expect(page.getByText("This page could not be found")).toHaveCount(0);
      // Les moteurs de recherche ne gardent pas ces adresses.
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    });
  }

  test("en arabe : 404, texte arabe, de droite à gauche", async ({ page }) => {
    for (const path of ["/ar/annonce/identifiant-qui-nexiste-pas", "/ar/cette-page-nexiste-pas"]) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(404);
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
      await expect(page.getByRole("heading", { level: 1, name: "الصفحة غير موجودة" })).toBeVisible();
    }
  });

  test("le lien « Retour à l'accueil » de la page introuvable fonctionne", async ({ page }) => {
    await page.goto("/fr/cette-page-nexiste-pas");
    await page.getByRole("link", { name: "Retour à l'accueil" }).click();
    await expect(page).toHaveURL(/\/fr\/?$/);
  });
});
