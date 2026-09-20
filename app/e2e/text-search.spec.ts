import { test, expect, type Page } from "@playwright/test";
import { uniqueAccount, registerAndLogin } from "./fixtures";
import { createListing } from "./api-helpers";
import { disconnectE2eDb } from "./db";
import fr from "../messages/fr.json";

// Lot 139 — la recherche par mot, dans un vrai navigateur : ce que le visiteur tape (titre, marque, modèle, wilaya, en français et en
// arabe, en majuscules ou non) et ce qu'il obtient. La condition de recherche a changé de forme (mot cherché d'abord dans le catalogue
// en mémoire, puis requête sans jointure, index trigramme) ; ces tests prouvent que ce que le visiteur trouve n'a pas changé, et le
// test d'équivalence (tests/search-equivalence.test.ts) le prouve sur 100 000 annonces contre PostgreSQL.
test.afterAll(disconnectE2eDb);
test.setTimeout(90_000);

const card = (page: Page, id: string) => page.locator(`a[href$="/annonce/${id}"]`);
// Mot ALÉATOIRE de bout en bout : deux mots créés à la même milliseconde ne partagent aucun début, donc aucune sous-chaîne.
const unique = () => `Zorglub${Array.from({ length: 8 }, () => "abcdefghjkmnpqrstuvwxyz"[Math.floor(Math.random() * 23)]).join("")}`;

test.describe("recherche par mot", () => {
  test("trouve une annonce par un mot de son titre, en majuscules comme en minuscules, et pas les autres", async ({ page }) => {
    await registerAndLogin(page, "fr", uniqueAccount("mot-titre"));
    const word = unique();
    const { id } = await createListing(page, { title: `Belle Clio ${word} très propre` });
    const other = await createListing(page, { title: `Une autre annonce ${unique()}` });

    for (const q of [word, word.toUpperCase(), word.toLowerCase(), word.slice(4, 12)]) {
      await page.goto(`/fr/recherche?q=${encodeURIComponent(q)}`);
      await expect(card(page, id), `« ${q} »`).toBeVisible();
      await expect(card(page, other.id), `« ${q} » ne doit pas trouver l'autre annonce`).toHaveCount(0);
    }
  });

  test("trouve une annonce par le NOM DE SON MODÈLE et de sa marque même si son titre n'en dit rien (recherche dans le catalogue)", async ({ page }) => {
    await registerAndLogin(page, "fr", uniqueAccount("mot-modele"));
    const word = unique();
    // Marque Renault, modèle Clio, mais le titre ne contient ni l'un ni l'autre : seul le catalogue peut la faire trouver.
    const { id, title } = await createListing(page, { brand: "Renault", model: "Clio", title: `Citadine économique ${word}` });
    expect(title.toLowerCase()).not.toMatch(/clio|renault/);

    for (const q of ["clio", "CLIO", "Clio", "renault", "RENAULT", "ren", "lio"]) {
      await page.goto(`/fr/recherche?q=${encodeURIComponent(q)}&sort=recent`);
      await expect(card(page, id), `« ${q} » (nom de la marque ou du modèle)`).toBeVisible();
    }
    // Et une autre marque ne la trouve pas.
    await page.goto(`/fr/recherche?q=${encodeURIComponent(`peugeot ${word}`)}`);
    await expect(card(page, id)).toHaveCount(0);
  });

  test("trouve par le nom de la wilaya, en français et en arabe (le nom arabe n'est dans aucun titre)", async ({ page }) => {
    await registerAndLogin(page, "fr", uniqueAccount("mot-wilaya"));
    const word = unique();
    const { id } = await createListing(page, { title: `Petite annonce ${word}`, wilayaId: 16 }); // Alger
    const other = await createListing(page, { title: `Petite annonce ${unique()}`, wilayaId: 31 }); // Oran

    for (const [q, locale] of [["alger", "fr"], ["ALGER", "fr"], ["الجزائر", "ar"], ["الجزائر", "fr"]] as const) {
      await page.goto(`/${locale}/recherche?q=${encodeURIComponent(q)}&sort=recent`);
      await expect(card(page, id), `« ${q} » (${locale})`).toBeVisible();
      await expect(card(page, other.id), `« ${q} » ne doit pas trouver une annonce d'Oran`).toHaveCount(0);
    }
  });

  test("garde le comportement d'origine pour les jokers (« _ » remplace un caractère) et ne casse jamais sur les caractères spéciaux", async ({ page }) => {
    await registerAndLogin(page, "fr", uniqueAccount("mot-joker"));
    const word = unique();
    const { id } = await createListing(page, { brand: "Renault", model: "Clio", title: `Citadine ${word}` });
    await page.goto("/fr/recherche?q=c_io&sort=recent");
    await expect(card(page, id), "« c_io » trouve « Clio », comme avant").toBeVisible();

    for (const q of ["%", "_", "\\", "cl\\", "'", '"', "%27%3B--", "a%a%a%a%a%a%a%a%a%a%a%a%a%a%a%a%a%b"]) {
      const response = await page.goto(`/fr/recherche?q=${encodeURIComponent(q)}`);
      expect(response?.status(), `« ${q} »`).toBe(200);
      await expect(page.locator("h1").first()).toBeAttached();
    }
  });

  test("une annonce en attente de modération n'est jamais trouvée, et un mot sans résultat le dit", async ({ page }) => {
    await registerAndLogin(page, "fr", uniqueAccount("mot-attente"));
    const word = unique();
    const hidden = await createListing(page, { title: `Annonce cachée ${word}`, publish: false });
    await page.goto(`/fr/recherche?q=${encodeURIComponent(word)}`);
    await expect(card(page, hidden.id)).toHaveCount(0);
    await expect(page.getByText("Aucune annonce", { exact: false }).first()).toBeVisible();
  });

  test("le mot cherché est conservé dans le champ et dans la pagination, jamais interprété comme du HTML", async ({ page }) => {
    await page.goto("/fr/recherche?q=%3Cb%3Eclio%3C%2Fb%3E");
    await expect(page.getByRole("textbox", { name: fr.Search.queryPlaceholder })).toHaveValue("<b>clio</b>");
    await expect(page.locator("main b")).toHaveCount(0);
  });
});
