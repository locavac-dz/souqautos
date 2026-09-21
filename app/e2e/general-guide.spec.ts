import { execFileSync } from "node:child_process";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { uniqueAccount, registerAndLogin } from "./fixtures";
import { createListing } from "./api-helpers";
import { disconnectE2eDb, e2eDb, makeAdmin } from "./db";
import { getE2eDatabaseUrl } from "./e2e-database";
import { GENERAL_BUYING_GUIDE } from "../src/content/general-buying-guide";
import fr from "../messages/fr.json";
import ar from "../messages/ar.json";

// Lot 144 — le guide d'achat GÉNÉRAL (aucun modèle : « acheter une voiture d'occasion »), dans le vrai serveur : sa création par
// l'administration (API, formulaire et script), son affichage sans lien de modèle, sa proposition sur les annonces dont le modèle n'a pas
// de guide propre, et les garanties de la base (contrainte de cohérence, suppression d'un modèle protégée). Les textes ci-dessous sont
// des données de TEST écrites dans la base jetable des tests de bout en bout.
test.afterAll(disconnectE2eDb);
test.setTimeout(120_000);

const tG = fr.Guide;

async function adminPage(page: Page, prefix: string) {
  const account = uniqueAccount(prefix);
  await registerAndLogin(page, "fr", account);
  await makeAdmin(account.email);
  return account;
}

async function clearGeneralGuides() {
  await e2eDb().blogArticle.deleteMany({ where: { kind: "GUIDE", guide: { modelId: null } } });
}

const stamp = () => Date.now().toString(36);

function generalPayload(title: string, publication: unknown = { mode: "now" }) {
  return {
    kind: "GUIDE",
    titleFr: title,
    titleAr: `دليل عام للاختبار ${title.slice(-6)}`,
    excerptFr: "Guide général de test : ce qu'il faut vérifier avant d'acheter une voiture d'occasion.",
    excerptAr: "دليل عام تجريبي: ما يجب التحقق منه قبل شراء سيارة مستعملة من أي علامة.",
    contentFr: "Contenu de test du guide général. ".repeat(4),
    contentAr: "محتوى تجريبي للدليل العام. ".repeat(4),
    publication,
    guide: {
      checklistFr: "Vérifier les papiers\nEssayer le véhicule",
      checklistAr: "التحقق من الوثائق\nتجربة السيارة",
      adviceFr: "Conseil de test : ne payez jamais avant d'avoir vu le véhicule et les papiers.",
      adviceAr: "نصيحة تجريبية: لا تدفع أبدًا قبل أن ترى السيارة والوثائق.",
    },
  };
}

async function createGeneral(page: Page, title: string, publication?: unknown): Promise<{ id: string; slug: string }> {
  const response = await page.request.post("/api/admin/blog", { data: generalPayload(title, publication) });
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()).article;
}

test.describe("un guide général, publié", () => {
  test("s'affiche sans ligne de véhicule ni lien de modèle, propose de voir toutes les annonces, et figure au plan du site", async ({ page, request }) => {
    await adminPage(page, "general-public");
    await clearGeneralGuides();
    const title = `Guide général de test ${stamp()}`;
    const { id, slug } = await createGeneral(page, title);

    try {
      // La base : marque, modèle et génération sont tous nuls.
      const row = await e2eDb().buyingGuide.findUniqueOrThrow({ where: { articleId: id } });
      expect(row).toMatchObject({ brandId: null, modelId: null, generationId: null });

      for (const [locale, seeAll, seeModel] of [["fr", tG.seeAllListings, "Fiche du modèle"], ["ar", ar.Guide.seeAllListings, ar.Guide.seeModel.replace("{vehicle}", "").trim()]] as const) {
        // L'index le liste, sans ligne de véhicule (la marque et le modèle n'existent pas).
        await page.goto(`/${locale}/guides`);
        const card = page.getByRole("link").filter({ hasText: locale === "fr" ? title : `دليل عام للاختبار ${title.slice(-6)}` });
        await expect(card).toBeVisible();
        await expect(card.locator("p.uppercase")).toHaveCount(0);

        // Sa page : le sur-titre est « Guide d'achat » seul, sans « · marque modèle », et aucun lien vers une page de modèle.
        await page.goto(`/${locale}/guides/${slug}`);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        const kicker = page.locator("p.uppercase").first();
        await expect(kicker).toHaveText(locale === "fr" ? tG.kicker : ar.Guide.kicker);
        await expect(page.getByRole("link", { name: seeAll })).toBeVisible();
        await expect(page.getByRole("link", { name: new RegExp(seeModel) })).toHaveCount(0);
        await expect(page.locator('a[href*="/voitures/"]')).toHaveCount(0); // aucune page de modèle
      }
      // « Voir toutes les annonces » mène à la recherche, sans filtre de modèle.
      await page.goto(`/fr/guides/${slug}`);
      await page.getByRole("link", { name: tG.seeAllListings }).click();
      await expect(page).toHaveURL(/\/fr\/recherche$/);

      // Le plan du site le contient, dans les deux langues.
      const sitemap = await (await request.get("/sitemap.xml")).text();
      expect(sitemap).toContain(`/fr/guides/${slug}`);
      expect(sitemap).toContain(`/ar/guides/${slug}`);
    } finally {
      await clearGeneralGuides();
    }
  });

  test("n'apparaît sur la page d'AUCUN modèle du catalogue", async ({ page }) => {
    await adminPage(page, "general-nomodel");
    await clearGeneralGuides();
    const title = `Guide général hors modèle ${stamp()}`;
    await createGeneral(page, title);
    try {
      for (const path of ["/fr/voitures/renault/clio", "/fr/voitures/peugeot/208", "/fr/voitures/renault"]) {
        await page.goto(path);
        await expect(page.getByRole("link").filter({ hasText: title }), path).toHaveCount(0);
      }
    } finally {
      await clearGeneralGuides();
    }
  });
});

test.describe("sur la fiche d'une annonce", () => {
  test("le guide général est proposé quand le modèle n'a pas de guide ; celui du modèle passe avant ; un brouillon n'est jamais proposé", async ({ page }) => {
    await adminPage(page, "general-listing");
    await clearGeneralGuides();
    const seller = uniqueAccount("general-seller");
    // Le vendeur d'une annonce : un compte ordinaire, dans un autre contexte que l'administrateur.
    const sellerPage = await page.context().browser()!.newPage();
    await registerAndLogin(sellerPage, "fr", seller);
    const { id: listingId } = await createListing(sellerPage, { brand: "Peugeot", model: "208" });
    await sellerPage.close();
    const banner = (title: string) => page.getByRole("link").filter({ hasText: fr.Listing.buyingGuideLabel }).filter({ hasText: title });
    const modelGuideIds: string[] = [];

    try {
      // 1. Aucun guide nulle part : aucune proposition.
      await page.goto(`/fr/annonce/${listingId}`);
      await expect(page.getByText(fr.Listing.buyingGuideLabel)).toHaveCount(0);

      // 2. Un guide général en BROUILLON : toujours rien (jamais un brouillon proposé au public).
      const draftTitle = `Guide général brouillon ${stamp()}`;
      const draft = await createGeneral(page, draftTitle, { mode: "draft" });
      await page.goto(`/fr/annonce/${listingId}`);
      await expect(page.getByText(fr.Listing.buyingGuideLabel)).toHaveCount(0);

      // 3. Un guide général PUBLIÉ : proposé, en français comme en arabe.
      const generalTitle = `Guide général publié ${stamp()}`;
      await createGeneral(page, generalTitle);
      await page.goto(`/fr/annonce/${listingId}`);
      await expect(banner(generalTitle)).toBeVisible();
      await expect(page.getByText(draftTitle)).toHaveCount(0);
      await page.goto(`/ar/annonce/${listingId}`);
      await expect(page.getByRole("link").filter({ hasText: ar.Listing.buyingGuideLabel })).toBeVisible();

      // 3 bis. Le guide d'un AUTRE modèle (Renault Clio), plus récent, n'est jamais proposé sur cette annonce : seul le guide général l'est.
      const clio = await e2eDb().model.findFirstOrThrow({ where: { name: "Clio", brand: { name: "Renault" } }, select: { id: true } });
      const otherTitle = `Guide d'un autre modèle ${stamp()}`;
      const other = await page.request.post("/api/admin/blog", { data: { ...generalPayload(otherTitle), guide: { ...generalPayload(otherTitle).guide, modelId: clio.id } } });
      expect(other.status(), await other.text()).toBe(201);
      modelGuideIds.push((await other.json()).article.id);
      await page.goto(`/fr/annonce/${listingId}`);
      await expect(banner(generalTitle)).toBeVisible();
      await expect(page.getByText(otherTitle)).toHaveCount(0);

      // 4. Un guide propre au modèle (Peugeot 208) : il PASSE AVANT le guide général.
      const model = await e2eDb().model.findFirstOrThrow({ where: { name: "208", brand: { name: "Peugeot" } }, select: { id: true } });
      const modelTitle = `Guide du modèle publié ${stamp()}`;
      const created = await page.request.post("/api/admin/blog", { data: { ...generalPayload(modelTitle), guide: { ...generalPayload(modelTitle).guide, modelId: model.id } } });
      expect(created.status(), await created.text()).toBe(201);
      modelGuideIds.push((await created.json()).article.id);
      await page.goto(`/fr/annonce/${listingId}`);
      await expect(banner(modelTitle)).toBeVisible();
      await expect(page.getByText(generalTitle)).toHaveCount(0);

      // 5. Le brouillon n'a jamais été proposé, même après tout cela.
      await expect(page.getByText(draftTitle)).toHaveCount(0);
      void draft;
    } finally {
      await e2eDb().blogArticle.deleteMany({ where: { id: { in: modelGuideIds } } });
      await clearGeneralGuides();
    }
  });
});

test.describe("modifier un guide", () => {
  test("un guide de modèle devient général quand on retire son modèle, et inversement — tout est remis à zéro", async ({ page }) => {
    await adminPage(page, "general-edit");
    const model = await e2eDb().model.findFirstOrThrow({ where: { name: "Clio", brand: { name: "Renault" } }, select: { id: true, brandId: true } });
    const title = `Guide à convertir ${stamp()}`;
    const withModel = { ...generalPayload(title), guide: { ...generalPayload(title).guide, modelId: model.id } };
    const created = await page.request.post("/api/admin/blog", { data: withModel });
    expect(created.status(), await created.text()).toBe(201);
    const { id } = (await created.json()).article;

    try {
      expect(await e2eDb().buyingGuide.findUniqueOrThrow({ where: { articleId: id } })).toMatchObject({ modelId: model.id, brandId: model.brandId });

      // Retirer le modèle : marque, modèle et génération repassent à null, EXPLICITEMENT.
      const toGeneral = await page.request.patch(`/api/admin/blog/${id}`, { data: generalPayload(title) });
      expect(toGeneral.status(), await toGeneral.text()).toBe(200);
      expect(await e2eDb().buyingGuide.findUniqueOrThrow({ where: { articleId: id } })).toMatchObject({ modelId: null, brandId: null, generationId: null });

      // Et inversement : lui redonner un modèle lui redonne sa marque, déduite du modèle (jamais lue du navigateur).
      const backToModel = await page.request.patch(`/api/admin/blog/${id}`, { data: withModel });
      expect(backToModel.status(), await backToModel.text()).toBe(200);
      expect(await e2eDb().buyingGuide.findUniqueOrThrow({ where: { articleId: id } })).toMatchObject({ modelId: model.id, brandId: model.brandId });
    } finally {
      await e2eDb().blogArticle.deleteMany({ where: { id } });
    }
  });

  test("une génération sans modèle est refusée (400), et rien n'est créé", async ({ page }) => {
    await adminPage(page, "general-generation");
    const before = await e2eDb().blogArticle.count({ where: { kind: "GUIDE" } });
    const response = await page.request.post("/api/admin/blog", { data: { ...generalPayload(`Guide génération ${stamp()}`), guide: { ...generalPayload("x").guide, generationId: 1 } } });
    expect(response.status()).toBe(400);
    expect(await e2eDb().blogArticle.count({ where: { kind: "GUIDE" } })).toBe(before);
  });
});

test.describe("le formulaire d'administration", () => {
  test("crée un guide général sans qu'on choisisse de modèle, en brouillon", async ({ page }) => {
    await adminPage(page, "general-form");
    await clearGeneralGuides();
    const title = `Guide général du formulaire ${stamp()}`;

    await page.goto("/fr/admin/guides/nouveau");
    // Le champ « modèle » n'est plus obligatoire, et propose explicitement le guide général.
    await expect(page.getByLabel(fr.AdminGuide.modelLabel)).toBeVisible();
    await expect(page.getByLabel(fr.AdminGuide.modelLabel)).toContainText(fr.AdminGuide.generalOption);

    await page.getByLabel(fr.AdminBlog.titleFrLabel).fill(title);
    await page.getByLabel(fr.AdminBlog.titleArLabel).fill("دليل عام من النموذج للاختبار");
    await page.getByLabel(fr.AdminBlog.excerptFrLabel).fill("Guide général créé depuis le formulaire, sans modèle du catalogue.");
    await page.getByLabel(fr.AdminBlog.excerptArLabel).fill("دليل عام أُنشئ من النموذج دون اختيار طراز من الفهرس.");
    await page.getByLabel(fr.AdminBlog.contentFrLabel).fill("Contenu de test du formulaire. ".repeat(6));
    await page.getByLabel(fr.AdminBlog.contentArLabel).fill("محتوى تجريبي للنموذج. ".repeat(6));
    await page.getByLabel(fr.AdminGuide.checklistFrLabel).fill("Vérifier les papiers\nEssayer le véhicule");
    await page.getByLabel(fr.AdminGuide.checklistArLabel).fill("التحقق من الوثائق\nتجربة السيارة");
    await page.getByLabel(fr.AdminGuide.adviceFrLabel).fill("Conseil de test du formulaire : ne payez jamais avant d'avoir vu le véhicule.");
    await page.getByLabel(fr.AdminGuide.adviceArLabel).fill("نصيحة تجريبية من النموذج: لا تدفع قبل أن ترى السيارة.");
    // Aucune marque, aucun modèle choisis.
    await page.getByRole("button", { name: fr.AdminBlog.save }).click();

    await expect(page).toHaveURL(/\/fr\/admin\/guides$/);
    try {
      const created = await e2eDb().blogArticle.findFirstOrThrow({ where: { titleFr: title }, include: { guide: true } });
      expect(created.kind).toBe("GUIDE");
      expect(created.publishedAt).toBeNull(); // brouillon par défaut
      expect(created.guide).toMatchObject({ brandId: null, modelId: null, generationId: null });
    } finally {
      await clearGeneralGuides();
    }
  });
});

test.describe("les garanties de la base", () => {
  test("la contrainte de cohérence refuse un guide à demi rattaché ; supprimer un modèle qui a un guide est refusé par la base elle-même", async ({ page }) => {
    await adminPage(page, "general-db");
    const model = await e2eDb().model.findFirstOrThrow({ where: { name: "Clio", brand: { name: "Renault" } }, select: { id: true, brandId: true } });
    const author = await e2eDb().user.findFirstOrThrow({ where: { role: "ADMIN" }, select: { id: true } });
    const makeArticle = async (label: string) =>
      (await e2eDb().blogArticle.create({ data: { slug: `garanties-${label}-${stamp()}`, kind: "GUIDE", titleFr: `Garanties ${label} ${stamp()}`, titleAr: "ضمانات القاعدة للاختبار", excerptFr: "Article de test des garanties de la base.", excerptAr: "مقال تجريبي لضمانات قاعدة البيانات.", contentFr: "x".repeat(120), contentAr: "y".repeat(120), authorId: author.id }, select: { id: true } })).id;
    const sheet = { checklistFr: "a", checklistAr: "ب", adviceFr: "c".repeat(20), adviceAr: "د".repeat(20) };
    const ids: string[] = [];

    try {
      // Un modèle sans sa marque, une génération sans modèle, une marque sans modèle : trois incohérences, trois refus.
      const a = await makeArticle("modele-sans-marque"); ids.push(a);
      await expect(e2eDb().buyingGuide.create({ data: { articleId: a, modelId: model.id, brandId: null, ...sheet } })).rejects.toThrow();
      const b = await makeArticle("generation-sans-modele"); ids.push(b);
      await expect(e2eDb().buyingGuide.create({ data: { articleId: b, modelId: null, brandId: null, generationId: 1, ...sheet } })).rejects.toThrow();
      const c = await makeArticle("marque-sans-modele"); ids.push(c);
      await expect(e2eDb().buyingGuide.create({ data: { articleId: c, modelId: null, brandId: model.brandId, ...sheet } })).rejects.toThrow();

      // Les deux formes COHÉRENTES sont acceptées : général (tout à null) et de modèle (modèle et marque).
      const general = await makeArticle("general"); ids.push(general);
      await e2eDb().buyingGuide.create({ data: { articleId: general, modelId: null, brandId: null, ...sheet } });
      const scoped = await makeArticle("modele"); ids.push(scoped);
      await e2eDb().buyingGuide.create({ data: { articleId: scoped, modelId: model.id, brandId: model.brandId, ...sheet } });

      // Supprimer un modèle qui a un guide est REFUSÉ par la base elle-même (RESTRICT). Sur un modèle NEUF, dont seul ce guide dépend :
      // la Clio, elle, est aussi liée à des annonces, donc sa suppression échouerait pour une tout autre raison. Sans le RESTRICT
      // explicite, une relation facultative se défait en silence (SET NULL) et le guide d'un modèle deviendrait un guide général.
      const yamaha = await e2eDb().brand.findFirstOrThrow({ where: { name: "Yamaha" }, select: { id: true } });
      const lonelyName = `ZZ Modèle garanties ${stamp()}`;
      const lonely = await e2eDb().model.create({ data: { name: lonelyName, slug: `zz-modele-garanties-${stamp()}`, brandId: yamaha.id, categories: ["DEUX_ROUES"] } });
      const guarded = await makeArticle("modele-protege"); ids.push(guarded);
      await e2eDb().buyingGuide.create({ data: { articleId: guarded, modelId: lonely.id, brandId: yamaha.id, ...sheet } });
      // Le refus doit être celui d'une CLÉ ÉTRANGÈRE (P2003), pas d'une autre contrainte : c'est la clé étrangère qu'on éprouve ici.
      await expect(e2eDb().model.delete({ where: { id: lonely.id } })).rejects.toMatchObject({ code: "P2003" });
      expect(await e2eDb().buyingGuide.findUniqueOrThrow({ where: { articleId: guarded } })).toMatchObject({ modelId: lonely.id, brandId: yamaha.id });
      // Le guide retiré, le modèle peut enfin partir : c'est bien ce guide seul qui le retenait.
      await e2eDb().blogArticle.deleteMany({ where: { id: guarded } });
      await e2eDb().model.delete({ where: { id: lonely.id } });
    } finally {
      await e2eDb().blogArticle.deleteMany({ where: { id: { in: ids } } });
    }
  });
});

test.describe("`npm run content:guide-general`", () => {
  const appRoot = path.resolve(__dirname, "..");
  const run = (args: string[]) => {
    try {
      const stdout = execFileSync(process.execPath, [path.join(appRoot, "node_modules", "tsx", "dist", "cli.mjs"), "scripts/create-general-guide.ts", ...args], {
        cwd: appRoot,
        env: { ...process.env, DATABASE_URL: getE2eDatabaseUrl(), REDIS_URL: "", SMTP_HOST: "" },
        encoding: "utf8",
        stdio: "pipe",
      });
      return { status: 0, stdout, stderr: "" };
    } catch (error) {
      const failed = error as { status?: number; stdout?: string; stderr?: string };
      return { status: failed.status ?? 1, stdout: String(failed.stdout ?? ""), stderr: String(failed.stderr ?? "") };
    }
  };

  test("crée le guide livré EN BROUILLON, sans modèle, avec exactement le texte du dépôt ; ne le recrée pas ; refuse un auteur qui n'est pas administrateur", async ({ page, request }) => {
    const admin = await adminPage(page, "general-script");
    await clearGeneralGuides();
    const ordinary = uniqueAccount("general-ordinary");
    const ordinaryPage = await page.context().browser()!.newPage();
    await registerAndLogin(ordinaryPage, "fr", ordinary);
    await ordinaryPage.close();

    try {
      // Un auteur qui n'est pas administrateur, ou qui n'existe pas : refus, rien n'est créé.
      const notAdmin = run(["--author", ordinary.email]);
      expect(notAdmin.status).toBe(1);
      expect(notAdmin.stderr).toContain("n'est pas administrateur");
      expect(run(["--author", "inconnu-du-guide@example.dz"]).status).toBe(1);
      expect(await e2eDb().blogArticle.count({ where: { kind: "GUIDE", guide: { modelId: null } } })).toBe(0);

      // Création : brouillon, signé par l'administrateur désigné, avec le texte EXACT du dépôt.
      const created = run(["--author", admin.email]);
      expect(created.status, created.stderr).toBe(0);
      expect(created.stdout).toContain("EN BROUILLON");
      const article = await e2eDb().blogArticle.findFirstOrThrow({ where: { kind: "GUIDE", guide: { modelId: null } }, include: { guide: true, author: { select: { email: true } } } });
      expect(article.publishedAt).toBeNull(); // JAMAIS publié par le script
      expect(article.author.email).toBe(admin.email);
      expect(article).toMatchObject({ titleFr: GENERAL_BUYING_GUIDE.titleFr, titleAr: GENERAL_BUYING_GUIDE.titleAr, contentFr: GENERAL_BUYING_GUIDE.contentFr, contentAr: GENERAL_BUYING_GUIDE.contentAr });
      expect(article.guide).toMatchObject({ brandId: null, modelId: null, generationId: null, checklistFr: GENERAL_BUYING_GUIDE.checklistFr, adviceAr: GENERAL_BUYING_GUIDE.adviceAr });
      expect(await e2eDb().auditLog.findFirst({ where: { action: "blog_article.create", targetId: article.id } })).not.toBeNull();

      // Un brouillon n'est visible du PUBLIC pour personne : vrai 404, dans les deux langues (la requête de test n'a aucun cookie). Seul
      // l'administrateur connecté le voit, en aperçu (Lot 145) — c'est ainsi que l'équipe le relit mis en page avant de le publier.
      for (const locale of ["fr", "ar"]) {
        expect((await request.get(`/${locale}/guides/${article.slug}`)).status(), `${locale} : public`).toBe(404);
        expect((await page.request.get(`/${locale}/guides/${article.slug}`)).status(), `${locale} : administrateur`).toBe(200);
      }

      // Relancé : il ne crée pas de second guide et le dit.
      const again = run(["--author", admin.email]);
      expect(again.status).toBe(0);
      expect(again.stdout).toContain("existe déjà");
      expect(await e2eDb().blogArticle.count({ where: { kind: "GUIDE", guide: { modelId: null } } })).toBe(1);

      // Une fois publié par l'équipe (ici, à la main), il s'affiche pour de bon, structure et contenu compris.
      await e2eDb().blogArticle.update({ where: { id: article.id }, data: { publishedAt: new Date(Date.now() - 60_000) } });
      await page.goto(`/fr/guides/${article.slug}`);
      await expect(page.getByRole("heading", { level: 1, name: GENERAL_BUYING_GUIDE.titleFr })).toBeVisible();
      // Le Markdown est rendu : chaque section (##) devient un titre de niveau 2, chaque sous-section (###) un titre de niveau 3.
      for (const section of GENERAL_BUYING_GUIDE.contentFr.match(/^## .+$/gm)!) await expect(page.getByRole("heading", { level: 2, name: section.replace(/^## /, "") })).toBeVisible();
      for (const sub of GENERAL_BUYING_GUIDE.contentFr.match(/^### .+$/gm)!) await expect(page.getByRole("heading", { level: 3, name: sub.replace(/^### /, "") })).toBeVisible();
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1); // un seul <h1> : celui du guide, aucun titre de niveau 1 dans le corps
      await expect(page.getByText(fr.Guide.checklistTitle)).toBeVisible(); // la liste « à vérifier » et le conseil, hors du corps
      await expect(page.getByText(fr.Guide.adviceTitle)).toBeVisible();
      await expect(page.getByText("administration compétente").first()).toBeVisible(); // l'avertissement en tête
      await page.goto(`/ar/guides/${article.slug}`);
      await expect(page.getByRole("heading", { level: 1, name: GENERAL_BUYING_GUIDE.titleAr })).toBeVisible();
    } finally {
      await clearGeneralGuides();
    }
  });
});
