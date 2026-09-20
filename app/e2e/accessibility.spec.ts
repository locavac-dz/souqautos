import { test, expect } from "@playwright/test";
import { disconnectE2eDb, makeAdmin } from "./db";
import { uniqueAccount, registerAndLogin } from "./fixtures";
import { createListing } from "./api-helpers";
import { auditPages } from "./axe";
import { ADMIN_PAGES, MEMBER_PAGES, STATIC_PATHS, dynamicPaths } from "./public-paths";

// Lot 135 — accessibilité : chaque page du site, en français et en arabe, passée au crible d'axe-core (e2e/axe.ts) :
// pages publiques, espace d'un compte connecté (dont les 11 étapes de publication) et administration.
test.afterAll(disconnectE2eDb);
test.setTimeout(60_000);

for (const locale of ["fr", "ar"] as const) {
  test.describe(`accessibilité en ${locale === "fr" ? "français" : "arabe"}`, () => {
    test("pages publiques : aucune violation", async ({ page }) => {
      test.setTimeout(300_000);
      const paths = [...STATIC_PATHS, ...(await dynamicPaths())].map((path) => `/${locale}${path}`);
      expect(await auditPages(page, paths, `publiques ${locale}`)).toBe("");
    });

    test("compte connecté (tableau de bord, annonces, messages, profil, publication) : aucune violation", async ({ page }) => {
      test.setTimeout(300_000);
      await registerAndLogin(page, locale, uniqueAccount("a11y"));
      const { id } = await createListing(page, { publish: false });
      const paths = [...MEMBER_PAGES, `/compte/mes-annonces/${id}/modifier`].map((path) => `/${locale}${path}`);
      expect(await auditPages(page, paths, `compte ${locale}`)).toBe("");
    });

    test("administration : aucune violation", async ({ page }) => {
      test.setTimeout(300_000);
      const admin = uniqueAccount("a11y-admin");
      await registerAndLogin(page, locale, admin);
      await makeAdmin(admin.email);
      expect(await auditPages(page, ADMIN_PAGES.map((path) => `/${locale}${path}`), `administration ${locale}`)).toBe("");
    });
  });
}

// Ce qu'axe ne peut pas juger : l'usage au CLAVIER (sans souris), mesuré dans un vrai navigateur.
for (const locale of ["fr", "ar"] as const) {
  test.describe(`clavier en ${locale === "fr" ? "français" : "arabe"}`, () => {
    const skipLabel = locale === "fr" ? "Aller au contenu principal" : "انتقل إلى المحتوى الرئيسي";

    test("le premier arrêt est le lien « aller au contenu », visible au focus, qui amène le focus dans la page", async ({ page }) => {
      await page.goto(`/${locale}/guides`);
      await page.keyboard.press("Tab");
      const skip = page.getByRole("link", { name: skipLabel });
      await expect(skip).toBeFocused();
      await expect(skip).toBeInViewport(); // invisible tant qu'il n'a pas le focus, visible dès qu'il l'a
      await page.keyboard.press("Enter");
      await expect(page.locator("main#contenu")).toBeFocused();
      // Le Tab suivant part du contenu, pas de l'en-tête : le premier lien du menu n'est plus le prochain arrêt.
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => Boolean(document.activeElement?.closest("header")))).toBe(false);
    });

    test("chaque élément atteint au clavier montre où se trouve le focus (jamais de contour supprimé)", async ({ page }) => {
      const problems: string[] = [];
      for (const path of ["", "/recherche", "/connexion"]) {
        await page.goto(`/${locale}${path}`);
        await expect(page.locator("h1").first()).toBeVisible();
        for (let stop = 1; stop <= 25; stop++) {
          await page.keyboard.press("Tab");
          const focus = await page.evaluate(() => {
            const el = document.activeElement as HTMLElement | null;
            if (!el || el === document.body) return null;
            const style = getComputedStyle(el);
            const outline = style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0;
            const shadow = style.boxShadow !== "none";
            return { describe: `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""} « ${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 30)} »`, visible: outline || shadow };
          });
          if (focus && !focus.visible) problems.push(`/${locale}${path} : arrêt ${stop}, ${focus.describe} n'a aucun contour de focus`);
        }
      }
      expect(problems).toEqual([]);
    });

    test("sur téléphone, le menu s'ouvre au clavier, se ferme avec Échap (focus rendu au bouton) et après le choix d'une page", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(`/${locale}/guides`);
      const toggle = page.getByRole("button", { name: locale === "fr" ? "Menu" : "القائمة" });
      await toggle.focus();
      await page.keyboard.press("Enter");
      await expect(toggle).toHaveAttribute("aria-expanded", "true");

      await page.keyboard.press("Escape");
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      await expect(toggle).toBeFocused();

      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      const panelId = await toggle.getAttribute("aria-controls");
      expect(panelId, "le bouton doit désigner le menu qu'il ouvre").toBeTruthy();
      const firstLink = page.locator(`[id="${panelId}"] a[href]`).first();
      const target = await firstLink.getAttribute("href");
      await firstLink.click();
      await expect(page).toHaveURL(new RegExp(`${target}`));
      await expect(toggle, "le menu reste ouvert par-dessus la page choisie").toHaveAttribute("aria-expanded", "false");
    });
  });
}
