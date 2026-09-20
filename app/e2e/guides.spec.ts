import { test, expect, type Page } from "@playwright/test";
import { uniqueAccount, registerAndLogin } from "./fixtures";
import { disconnectE2eDb, e2eDb, makeAdmin } from "./db";
import fr from "../messages/fr.json";

// Lot 131 — guides d'achat, de leur création par l'administration jusqu'à leur lecture publique, en français et en arabe :
// publication immédiate, brouillon, publication programmée, page du modèle, plan du site, droits d'accès et protection
// du catalogue. Les textes ci-dessous sont des données de TEST, écrites dans la base jetable des tests de bout en bout :
// ils ne sont jamais publiés sur le vrai site.
test.afterAll(disconnectE2eDb);

const CHECKLIST_FR = ["Carnet d'entretien complet et à jour", "État de la courroie de distribution", "Traces de corrosion sous le véhicule"];
const CHECKLIST_AR = ["دفتر صيانة كامل ومحدَّث", "حالة سير التوقيت", "آثار الصدأ أسفل المركبة"];

async function adminPage(page: Page, prefix: string) {
  const account = uniqueAccount(prefix);
  await registerAndLogin(page, "fr", account);
  await makeAdmin(account.email);
  return account;
}

async function modelId(brand: string, model: string): Promise<number> {
  return (await e2eDb().model.findFirstOrThrow({ where: { name: model, brand: { name: brand } }, select: { id: true } })).id;
}

function guidePayload(options: { title: string; modelId: number; publication?: unknown }) {
  return {
    kind: "GUIDE",
    titleFr: options.title,
    titleAr: `دليل اختبار للشراء ${options.title.slice(-6)}`,
    excerptFr: "Guide de test des tests de bout en bout : ce qu'il faut vérifier avant d'acheter ce modèle.",
    excerptAr: "دليل تجريبي لاختبارات النظام: ما يجب التحقق منه قبل شراء هذا الطراز.",
    contentFr: "Contenu de test des tests de bout en bout. ".repeat(4),
    contentAr: "محتوى تجريبي لاختبارات النظام الشاملة. ".repeat(4),
    publication: options.publication ?? { mode: "now" },
    guide: {
      modelId: options.modelId,
      checklistFr: CHECKLIST_FR.join("\n"),
      checklistAr: CHECKLIST_AR.join("\n"),
      adviceFr: "Conseil de test : faites contrôler le véhicule par un mécanicien indépendant avant tout paiement.",
      adviceAr: "نصيحة تجريبية: اطلب من ميكانيكي مستقل فحص المركبة قبل أي دفع.",
    },
  };
}

async function createGuide(page: Page, payload: ReturnType<typeof guidePayload>): Promise<{ id: string; slug: string }> {
  const response = await page.request.post("/api/admin/blog", { data: payload });
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()).article;
}

test.describe("guide d'achat publié", () => {
  test("apparaît dans l'index, sur sa page, sur la page du modèle et dans le plan du site, en français et en arabe", async ({ page, request }) => {
    await adminPage(page, "guide-admin");
    const title = `Guide de test E2E Renault Clio ${Date.now()}`;
    const { slug } = await createGuide(page, guidePayload({ title, modelId: await modelId("Renault", "Clio") }));

    // Visiteur anonyme
    await page.context().clearCookies();
    await page.goto("/fr/guides");
    await expect(page.getByRole("link", { name: new RegExp(title) })).toBeVisible();

    await page.getByRole("link", { name: new RegExp(title) }).first().click();
    await expect(page).toHaveURL(new RegExp(`/fr/guides/${slug}$`));
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.getByRole("heading", { name: fr.Guide.checklistTitle })).toBeVisible();
    for (const item of CHECKLIST_FR) await expect(page.getByText(item)).toBeVisible();
    await expect(page.getByRole("heading", { name: fr.Guide.adviceTitle })).toBeVisible();
    await expect(page.getByText("faites contrôler le véhicule par un mécanicien indépendant")).toBeVisible();

    // Données structurées valides
    const ld = (await page.locator('script[type="application/ld+json"]').allTextContents()).map((t) => JSON.parse(t) as { "@type": string });
    expect(ld.some((block) => block["@type"] === "Article" || block["@type"] === "BreadcrumbList")).toBe(true);

    // Liens vers le modèle et vers ses annonces
    await page.getByRole("link", { name: /Fiche du modèle Renault Clio/ }).click();
    await expect(page).toHaveURL(/\/fr\/voitures\/renault\/clio/);
    // …et la page du modèle renvoie vers le guide
    await expect(page.getByRole("link", { name: new RegExp(title) })).toBeVisible();

    // Plan du site
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).toContain(`/fr/guides/${slug}`);
    expect(sitemap).toContain(`/ar/guides/${slug}`);

    // Version arabe : de droite à gauche, titre et liste en arabe
    await page.goto(`/ar/guides/${slug}`);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    for (const item of CHECKLIST_AR) await expect(page.getByText(item)).toBeVisible();
    await expect(page.getByText("نصيحة تجريبية")).toBeVisible();
  });
});

test.describe("brouillon et publication programmée", () => {
  test("un brouillon n'est visible nulle part ; une publication programmée apparaît d'elle-même à sa date, sans reconstruire le site", async ({ page, request }) => {
    await adminPage(page, "guide-planif");
    const clio = await modelId("Renault", "Clio");
    const draftTitle = `Guide de test E2E brouillon ${Date.now()}`;
    const scheduledTitle = `Guide de test E2E programmé ${Date.now()}`;
    const draft = await createGuide(page, guidePayload({ title: draftTitle, modelId: clio, publication: { mode: "draft" } }));
    const scheduled = await createGuide(page, guidePayload({ title: scheduledTitle, modelId: clio, publication: { mode: "scheduled", at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString() } }));

    await page.context().clearCookies();
    const notVisible = async () => {
      for (const slug of [draft.slug, scheduled.slug]) {
        expect((await page.goto(`/fr/guides/${slug}`))?.status(), slug).toBe(404);
        expect((await page.goto(`/ar/guides/${slug}`))?.status(), slug).toBe(404);
      }
      await page.goto("/fr/guides");
      await expect(page.getByText(draftTitle)).toHaveCount(0);
      await expect(page.getByText(scheduledTitle)).toHaveCount(0);
      const sitemap = await (await request.get("/sitemap.xml")).text();
      expect(sitemap).not.toContain(draft.slug);
      expect(sitemap).not.toContain(scheduled.slug);
    };
    await notVisible();

    // La date programmée est atteinte (on la ramène dans le passé) : le guide devient public tout seul.
    await e2eDb().blogArticle.update({ where: { id: scheduled.id }, data: { publishedAt: new Date(Date.now() - 60_000) } });
    expect((await page.goto(`/fr/guides/${scheduled.slug}`))?.status()).toBe(200);
    await page.goto("/fr/guides");
    await expect(page.getByRole("link", { name: new RegExp(scheduledTitle) })).toBeVisible();
    expect(await (await request.get("/sitemap.xml")).text()).toContain(scheduled.slug);

    // Le brouillon, lui, reste invisible.
    expect((await page.goto(`/fr/guides/${draft.slug}`))?.status()).toBe(404);
  });
});

test.describe("droits d'accès et validation", () => {
  test("seul un administrateur crée un guide ; un guide incohérent est refusé", async ({ browser, page, request }) => {
    const clio = await modelId("Renault", "Clio");
    const payload = guidePayload({ title: `Guide de test E2E droits ${Date.now()}`, modelId: clio });

    // Sans compte, puis avec un compte ordinaire : refusé (403), rien n'est créé.
    expect((await request.post("/api/admin/blog", { data: payload })).status()).toBe(403);
    const member = await browser.newContext();
    const memberPage = await member.newPage();
    await registerAndLogin(memberPage, "fr", uniqueAccount("membre"));
    expect((await memberPage.request.post("/api/admin/blog", { data: payload })).status()).toBe(403);
    await member.close();
    expect(await e2eDb().blogArticle.count({ where: { titleFr: payload.titleFr } })).toBe(0);

    // Administrateur : les règles de contenu s'appliquent.
    await adminPage(page, "guide-droits");
    const post = (data: unknown) => page.request.post("/api/admin/blog", { data });
    expect((await post({ ...payload, guide: undefined })).status(), "un guide sans sa fiche").toBe(400);
    expect((await post({ ...payload, kind: "ARTICLE" })).status(), "un article avec une fiche de guide").toBe(400);
    expect((await post({ ...payload, guide: { ...payload.guide, checklistFr: "" } })).status(), "une liste vide").toBe(400);
    expect((await post({ ...payload, guide: { ...payload.guide, checklistFr: Array(13).fill("Point à vérifier").join("\n") } })).status(), "13 points (12 au plus)").toBe(400);
    expect((await post({ ...payload, guide: { ...payload.guide, modelId: 99_999_999 } })).status(), "un modèle inexistant").toBe(400);
    expect((await post({ ...payload, titleAr: "court" })).status(), "un titre arabe trop court").toBe(400);
    expect(await e2eDb().blogArticle.count({ where: { titleFr: payload.titleFr } })).toBe(0);

    expect((await post(payload)).status()).toBe(201);
  });

  test("un modèle qui a un guide ne peut pas être supprimé du catalogue", async ({ page }) => {
    await adminPage(page, "guide-catalogue");
    const yamaha = await e2eDb().brand.findFirstOrThrow({ where: { name: "Yamaha" } });
    const created = await page.request.post(`/api/admin/brands/${yamaha.id}/models`, { data: { name: `ZZ Modèle E2E ${Date.now()}`, categories: ["DEUX_ROUES"] } });
    expect(created.status()).toBe(201);
    const newModel = (await created.json()).model as { id: number };
    await createGuide(page, guidePayload({ title: `Guide de test E2E modèle protégé ${Date.now()}`, modelId: newModel.id }));

    const refused = await page.request.delete(`/api/admin/models/${newModel.id}`);
    expect(refused.status()).toBe(409);
    expect(await refused.json()).toEqual({ error: "has_guides" });
    expect(await e2eDb().model.count({ where: { id: newModel.id } })).toBe(1);
  });
});
